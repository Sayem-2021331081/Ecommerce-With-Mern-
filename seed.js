const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Import Models
const BrandModel = require('./src/models/BrandModel');
const CategoryModel = require('./src/models/CategoryModel');
const ProductSliderModel = require('./src/models/ProductSliderModel');
const ProductModel = require('./src/models/ProductModel');
const ProductDetailModel = require('./src/models/ProductDetailModel');
const ReviewModel = require('./src/models/ReviewModel');
const FeatureModel = require('./src/models/FeaturesModel');

// DB Connection
const URI = "mongodb+srv://sayem:12345@cluster0.jqx4voa.mongodb.net/MernEcommerce";
const option = { user: '', pass: "", autoIndex: true };

mongoose.connect(URI, option).then(() => {
    console.log("Database Connected for Seeding");
    seedData();
}).catch((err) => {
    console.log("DB Connection Error:", err);
    process.exit(1);
});

async function seedData() {
    try {
        // Read JSON files
        const brands = sanitizeData(JSON.parse(fs.readFileSync(path.join(__dirname, 'dummy-data', 'brands.json'), 'utf-8')));
        const categories = sanitizeData(JSON.parse(fs.readFileSync(path.join(__dirname, 'dummy-data', 'categories.json'), 'utf-8')));
        const sliders = sanitizeData(JSON.parse(fs.readFileSync(path.join(__dirname, 'dummy-data', 'productsliders.json'), 'utf-8')), 'ProductSliderModel');
        const products = sanitizeData(JSON.parse(fs.readFileSync(path.join(__dirname, 'dummy-data', 'products.json'), 'utf-8')));
        const details = sanitizeData(JSON.parse(fs.readFileSync(path.join(__dirname, 'dummy-data', 'productdetails.json'), 'utf-8')));
        const reviews = sanitizeData(JSON.parse(fs.readFileSync(path.join(__dirname, 'dummy-data', 'reviews.json'), 'utf-8')));
        const features = sanitizeData(JSON.parse(fs.readFileSync(path.join(__dirname, 'dummy-data', 'features.json'), 'utf-8')));

        // Clear existing data (optional, but good for clean seed)
        await BrandModel.deleteMany({});
        await CategoryModel.deleteMany({});
        await ProductSliderModel.deleteMany({});
        await ProductModel.deleteMany({});
        await ProductDetailModel.deleteMany({});
        await ReviewModel.deleteMany({});
        await FeatureModel.deleteMany({});

        console.log("Cleared existing data.");

        // Insert new data
        await BrandModel.insertMany(brands);
        console.log("Brands seeded");

        await CategoryModel.insertMany(categories);
        console.log("Categories seeded");

        await ProductSliderModel.insertMany(sliders);
        console.log("Sliders seeded");

        await ProductModel.insertMany(products);
        console.log("Products seeded");

        await ProductDetailModel.insertMany(details);
        console.log("Product Details seeded");

        await ReviewModel.insertMany(reviews);
        console.log("Reviews seeded");

        await FeatureModel.insertMany(features);
        console.log("Features seeded");


        console.log("All data seeded successfully!");
        process.exit(0);

    } catch (error) {
        console.error("Error seeding data:", error);
        process.exit(1);
    }
}

function sanitizeData(data, modelName = '') {
    return data.map(item => {
        const newItem = { ...item };
        if (newItem._id && newItem._id.$oid) {
            newItem._id = newItem._id.$oid;
        }
        if (newItem.createdAt && newItem.createdAt.$date) {
            newItem.createdAt = new Date(newItem.createdAt.$date);
        }
        if (newItem.updatedAt && newItem.updatedAt.$date) {
            newItem.updatedAt = new Date(newItem.updatedAt.$date);
        }
        // Handle other fields if necessary, but these are the common ones in the provided JSON
        // Recursively check for other objects if needed, but for this flat structure it might be enough
        // Let's check for other potential fields like productID, categoryID etc which might be OIDs
        for (const key in newItem) {
            if (newItem[key] && typeof newItem[key] === 'object') {
                if (newItem[key].$oid) {
                    newItem[key] = newItem[key].$oid;
                } else if (newItem[key].$date) {
                    newItem[key] = new Date(newItem[key].$date);
                }
            }
        }

        // Fix for ProductSliderModel: map 'image' to 'img'
        if (modelName === 'ProductSliderModel' && newItem.image && !newItem.img) {
            newItem.img = newItem.image;
            delete newItem.image;
        }

        return newItem;
    });
}
