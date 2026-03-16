const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4.5 * 1024 * 1024, // 4.5MB limit for Vercel
  },
});

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

/**
 * POST /api/ocr/receipt
 * Extract grocery items from a receipt image using Gemini 1.5 Flash.
 */
router.post('/receipt', requireAuth, upload.single('receipt'), async (req, res) => {
  let fileBuffer;
  let mimeType;

  if (req.file) {
    fileBuffer = req.file.buffer;
    mimeType = req.file.mimetype;
  } else if (req.body.attachmentId) {
    try {
      const { rows } = await pool.query('SELECT data, content_type FROM attachments WHERE id = $1', [req.body.attachmentId]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Attachment not found' });
      }
      fileBuffer = rows[0].data;
      mimeType = rows[0].content_type;
    } catch (dbErr) {
      console.error('DB Fetch error for OCR:', dbErr);
      return res.status(500).json({ error: 'Failed to fetch attachment from database' });
    }
  } else {
    return res.status(400).json({ error: 'No receipt image or attachment ID provided' });
  }

  try {
    const modelsToTry = [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash-lite',
      'gemini-3.1-flash-lite-preview',
      'gemini-2.5-flash'
    ];

    // Prepare the image for Gemini (once for all models)
    const imagePart = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType: mimeType,
      },
    };

    let lastError = null;
    let successResult = null;
    let usedModel = '';

    for (const modelName of modelsToTry) {
      try {
        console.log(`[OCR] Trying model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });

        const prompt = `
          Extract all line items from this receipt image. 
          The receipt appears to be in a table format. Look for rows that have a name/description and a corresponding price.
          
          Identify the merchant/supplier name (look for the largest text or the header, e.g., "MUARA ANGKE (MASAK)").
          
          For each individual line item in the table, identify:
          - name: The product or service name (e.g., "CUMI", "IKAN KAKAP MERAH", "MASAK SEAFOOD")
          - quantity: The numerical quantity. If you see a quantity column, use it. If not, assume 1.
          - unit: The unit of measurement (e.g., "kg", "pcs", or null)
          - totalPrice: The total price for this specific line item.
          - unitPrice: The price per unit (if specified, otherwise same as totalPrice if quantity is 1).

          IMPORTANT RULES:
          1. DO NOT skip any rows that have a name and a value that looks like a price (e.g., 310,000, 100,000).
          2. Ignore rows that are explicitly summaries for the whole receipt (e.g., "TOTAL", "SUBTOTAL", "GRAND TOTAL", "TAX", "PPN", "CASH", "CHANGE").
          3. Treat table headers (like the top merchant name) as metadata, not as items.
          4. Ensure all prices are returned as integers without currency symbols or commas.

          Return strictly as a JSON object with the following structure:
          {
            "supplierName": "STRING",
            "date": "YYYY-MM-DD or null",
            "totalAmount": NUMBER,
            "currency": "IDR",
            "items": [
              { "name": "STRING", "quantity": NUMBER, "unit": "STRING|null", "totalPrice": NUMBER, "unitPrice": NUMBER|null }
            ]
          }
          
          Do not include markers like \`\`\`json or any other text. Return ONLY the JSON.
        `;

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        successResult = response.text();
        usedModel = modelName;
        console.log(`[OCR] Success with model: ${modelName}`);
        break; // Exit loop on success
      } catch (err) {
        lastError = err;
        console.warn(`[OCR] Model ${modelName} failed:`, err.message || err);
        // Continue to next model
      }
    }

    if (!successResult) {
      console.error('[OCR] All models failed in fallback chain.');
      throw lastError || new Error('All OCR models failed');
    }

    // Clean up potential markdown formatting
    const cleanedText = successResult.replace(/```json|```/g, '').trim();
    
    try {
      const parsedData = JSON.parse(cleanedText);
      // Inject some metadata about what worked
      parsedData._modelUsed = usedModel;
      res.json(parsedData);
    } catch (parseError) {
      console.error('Gemini result parsing error:', successResult);
      res.status(500).json({ 
        error: 'Failed to parse OCR result as JSON',
        rawText: successResult 
      });
    }
  } catch (err) {
    console.error('OCR Final Error:', err);
    const status = err.status || 500;
    res.status(status).json({ 
      error: 'OCR processing failed',
      details: err.message,
      code: err.status 
    });
  }
});

module.exports = router;
