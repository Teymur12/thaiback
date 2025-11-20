const multer = require('multer');
const cloudinary = require('../config/cloudinary'); // ✅ Config faylından import
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ✅ Cloudinary konfiqurasiyasını yoxlayın
if (!cloudinary.config().cloud_name || !cloudinary.config().api_key || !cloudinary.config().api_secret) {
  console.error('❌ Cloudinary konfiqurasiyası tapılmadı!');
  throw new Error('Cloudinary məlumatları .env faylında düzgün təyin edilməyib');
}

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'massage-app/advance-receipts',
    resource_type: 'auto',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 800, height: 800, crop: 'limit', quality: 'auto' }
    ]
  }
});

const uploadAdvanceReceipt = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Yalnız şəkil faylları dəstəklənir (JPG, PNG, GIF, WebP)'));
    }
  }
}).single('receiptImage');

module.exports = uploadAdvanceReceipt;