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
      'gemini-1.5-pro',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
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
          ACT AS A HIGH-PRECISION RECEIPT ANALYST.
          Extract every single line item from this receipt image. 
          
          THE RECEIPT HAS A TABLE STRUCTURE:
          - Look for a header like "MUARA ANGKE (MASAK)".
          - Look for rows that have a description on the left and a total price on the right (e.g., "CUMI" ... "310,000").
          - EVERYTHING between the header and the "TOTAL" row should be treated as a line item.
          
          FOR EACH LINE ITEM:
          1. name: The name of the item (e.g., "CUMI", "FISH", "KERANG IJO", "MASAK SEAFOOD").
          2. quantity: The amount. If no quantity is explicitly shown (common in simple tables), ASSUME 1.
          3. unit: The unit (kg, pcs, etc.) or null if not shown.
          4. totalPrice: The total price value. Extract the digits only (e.g., "310000"). 
          5. unitPrice: Calculate if needed, otherwise same as totalPrice if quantity is 1.

          CRITICAL RULES:
          - DO NOT skip items just because they don't have a quantity column.
          - BE AGGRESSIVE: If it's a row with a value on the right, it's likely an item.
          - IGNORE "TOTAL", "SUBTOTAL", and metadata like date/time.
          - Merchant name is likely "MUARA ANGKE" or similar.

          Return strictly as a JSON object:
          {
            "supplierName": "STRING",
            "date": "YYYY-MM-DD or null",
            "totalAmount": NUMBER,
            "currency": "IDR",
            "items": [
              { "name": "STRING", "quantity": NUMBER, "unit": "STRING|null", "totalPrice": NUMBER, "unitPrice": NUMBER|null }
            ]
          }
          
          Return ONLY JSON. No markdown, no commentary.
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
      
      // Sanitization: Ensure items is an array and prices are numbers
      if (parsedData.items && Array.isArray(parsedData.items)) {
        parsedData.items = parsedData.items.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 1,
          totalPrice: Math.round(parseFloat(String(item.totalPrice).replace(/,/g, ''))) || 0,
          unitPrice: item.unitPrice ? Math.round(parseFloat(String(item.unitPrice).replace(/,/g, ''))) : null
        }));
      } else {
        parsedData.items = [];
      }
      
      if (parsedData.totalAmount) {
        parsedData.totalAmount = Math.round(parseFloat(String(parsedData.totalAmount).replace(/,/g, ''))) || 0;
      }

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
