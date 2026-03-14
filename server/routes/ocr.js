const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
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
  if (!req.file) {
    return res.status(400).json({ error: 'No receipt image uploaded' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Prepare the image for Gemini
    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype,
      },
    };

    const prompt = `
      Extract all grocery items from this receipt image. 
      Identify the merchant/supplier name.
      For each item, identify:
      - name: The product name (e.g., "Susu UHT Full Cream")
      - quantity: The numerical quantity (e.g., 2)
      - unit: The unit of measurement (e.g., "kg", "pcs", "litre", or null if not specified)
      - totalPrice: The total price for this item/line
      - unitPrice: The price per unit (if specified, otherwise calculate or null)

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
      
      Do not include markers like \`\`\`json or any other text.
    `;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Clean up potential markdown formatting if Gemini ignored the "strictly" instruction
    const cleanedText = text.replace(/```json|```/g, '').trim();
    
    try {
      const parsedData = JSON.parse(cleanedText);
      res.json(parsedData);
    } catch (parseError) {
      console.error('Gemini result parsing error:', text);
      res.status(500).json({ 
        error: 'Failed to parse OCR result as JSON',
        rawText: text 
      });
    }
  } catch (err) {
    console.error('OCR Error:', err);
    res.status(500).json({ error: 'OCR processing failed' });
  }
});

module.exports = router;
