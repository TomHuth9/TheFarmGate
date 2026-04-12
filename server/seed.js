require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');
const Centre = require('./models/Centre');
const User = require('./models/User');

const centres = [
  {
    name: 'Farm Gate – London South',
    address: '12 Harvest Lane, Streatham, London',
    postcode: 'SW16 1AB',
    servedPostcodes: ['SW16', 'SW17', 'SW2', 'SW4', 'SE24', 'SE27'],
    deliveryDays: ['Tuesday', 'Friday'],
    phone: '020 7946 0123',
    email: 'london.south@thefarmgate.co.uk',
  },
  {
    name: 'Farm Gate – Manchester North',
    address: '5 Meadow Road, Didsbury, Manchester',
    postcode: 'M20 2AB',
    servedPostcodes: ['M20', 'M21', 'M14', 'M19', 'SK4'],
    deliveryDays: ['Wednesday', 'Saturday'],
    phone: '0161 496 0456',
    email: 'manchester.north@thefarmgate.co.uk',
  },
];

// Products without a farm (admin-created / platform stock)
const platformProducts = [
  // Dairy
  { name: 'Whole Milk', description: 'Full-fat unhomogenised milk from grass-fed Jerseys. Cream line guaranteed.', price: 1.45, category: 'Dairy', unit: 'per litre', featured: true, imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400' },
  { name: 'Mature Cheddar', description: 'Aged 18 months on the farm. Crumbly, sharp, and deeply savoury.', price: 6.50, category: 'Dairy', unit: 'per 300g', imageUrl: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400' },
  { name: 'Salted Butter', description: 'Churned slowly from cultured cream. Rich golden colour.', price: 3.20, category: 'Dairy', unit: 'per 250g', imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400' },
  { name: 'Natural Yoghurt', description: 'Thick, creamy yoghurt made with live cultures. No additives.', price: 2.80, category: 'Dairy', unit: 'per 500g', imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400' },
  // Beef
  { name: 'Ribeye Steak', description: 'Dry-aged 28 days. Exceptional marbling from our Hereford herd.', price: 18.00, category: 'Beef', unit: 'per 300g', featured: true, imageUrl: 'https://images.unsplash.com/photo-1558030137-a56c1b013beb?w=400' },
  { name: 'Beef Mince', description: '20% fat mince from shoulder and chuck. Perfect for bolognese.', price: 7.50, category: 'Beef', unit: 'per 500g', imageUrl: 'https://images.unsplash.com/photo-1588347818036-c8c87a6b29e4?w=400' },
  { name: 'Beef Brisket', description: 'Slow-roast cut, deeply flavourful. Ideal for low and slow cooking.', price: 12.00, category: 'Beef', unit: 'per kg', imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400' },
  { name: 'Sirloin Steak', description: 'Classic Sunday steak. Lean with a generous fat cap.', price: 15.00, category: 'Beef', unit: 'per 250g', imageUrl: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400' },
  // Pork
  { name: 'Back Bacon Rashers', description: 'Outdoor-bred, dry-cured for 5 days. No water added.', price: 5.50, category: 'Pork', unit: 'per 250g', featured: true, imageUrl: 'https://images.unsplash.com/photo-1607116612992-5a9ffb8b5d43?w=400' },
  { name: 'Pork Sausages', description: '85% pork, coarsely ground with herbs. Six per pack.', price: 5.00, category: 'Pork', unit: 'per 450g', imageUrl: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=400' },
  { name: 'Pork Belly', description: 'Five-layer belly, ideal for crackling roasts or slow braises.', price: 9.00, category: 'Pork', unit: 'per kg', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400' },
  { name: 'Pork Shoulder Joint', description: 'Bone-in shoulder. Slow-cook for 6 hours for pulled pork perfection.', price: 14.00, category: 'Pork', unit: 'per 1.5kg', imageUrl: 'https://images.unsplash.com/photo-1611171711912-e3f5b1e8b5d4?w=400' },
  // Vegetables
  { name: 'Seasonal Veg Box', description: 'Eight varieties of whatever is best this week. Harvested the morning of delivery.', price: 12.00, category: 'Vegetables', unit: 'per box', featured: true, imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400' },
  { name: 'New Potatoes', description: 'Waxy Charlotte variety. Boil, steam or roast.', price: 2.50, category: 'Vegetables', unit: 'per kg', imageUrl: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400' },
  { name: 'Salad Leaves Mix', description: 'Peppery rocket, little gem, and spinach. Washed and ready.', price: 2.20, category: 'Vegetables', unit: 'per 100g', imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400' },
  { name: 'Heritage Carrots', description: 'Purple, yellow and orange varieties. Sweeter than supermarket carrots.', price: 1.80, category: 'Vegetables', unit: 'per bunch', imageUrl: 'https://images.unsplash.com/photo-1445282768818-728615cc910a?w=400' },
  // Eggs
  { name: 'Free-Range Eggs', description: "Large hens' eggs from our mixed flock. Bright golden yolks.", price: 3.00, category: 'Eggs', unit: 'per dozen', featured: true, imageUrl: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?w=400' },
  { name: 'Duck Eggs', description: 'Rich, creamy duck eggs. Superb for baking and scrambling.', price: 4.50, category: 'Eggs', unit: 'per 6', imageUrl: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400' },
  // Poultry
  { name: 'Whole Chicken', description: 'Slowly grown, corn-fed. Exceptional flavour and texture. ~1.8kg.', price: 14.00, category: 'Poultry', unit: 'each', featured: true, imageUrl: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400' },
  { name: 'Chicken Thighs', description: 'Bone-in, skin-on thighs. The most flavourful cut for everyday cooking.', price: 6.50, category: 'Poultry', unit: 'per 500g', imageUrl: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c3?w=400' },
  { name: 'Chicken Breast Fillets', description: 'Plump, lean fillets from free-range birds. Two per pack.', price: 7.00, category: 'Poultry', unit: 'per 2', imageUrl: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400' },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    Centre.deleteMany({}),
    Product.deleteMany({}),
    User.deleteMany({ role: { $in: ['admin', 'farm'] } }),
  ]);
  console.log('Cleared existing data');

  const insertedCentres = await Centre.insertMany(centres);
  console.log(`Inserted ${insertedCentres.length} centres`);

  await Product.insertMany(platformProducts);
  console.log(`Inserted ${platformProducts.length} platform products`);

  // Demo admin
  await User.create({
    name: 'Farm Admin',
    email: 'admin@thefarmgate.co.uk',
    password: 'password123',
    role: 'admin',
  });
  console.log('Created admin: admin@thefarmgate.co.uk / password123');

  // Demo farm account
  const demoFarm = await User.create({
    name: 'Alice Green',
    email: 'meadowview@thefarmgate.co.uk',
    password: 'password123',
    role: 'farm',
    farmName: 'Meadow View Farm',
    farmDescription: 'A family-run mixed farm in the heart of Shropshire. We raise rare-breed cattle and grow heritage vegetables using traditional, low-input methods.',
    farmLocation: 'Shropshire, UK',
  });
  console.log('Created demo farm: meadowview@thefarmgate.co.uk / password123');

  // Demo farm products linked to that account
  const farmProducts = [
    { name: 'Longhorn Ribeye', description: 'From our small Longhorn herd. Dry-aged 35 days for maximum depth.', price: 22.00, category: 'Beef', unit: 'per 300g', featured: true, farm: demoFarm._id, imageUrl: 'https://images.unsplash.com/photo-1558030137-a56c1b013beb?w=400' },
    { name: 'Raw Jersey Milk', description: 'Unhomogenised, non-pasteurised. Only available for collection.', price: 1.80, category: 'Dairy', unit: 'per litre', farm: demoFarm._id, imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400' },
    { name: 'Mixed Salad Bag', description: 'Cut fresh on delivery day from our polytunnel. Eight varieties.', price: 2.50, category: 'Vegetables', unit: 'per 150g', farm: demoFarm._id, imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400' },
    { name: 'Goose Eggs', description: 'Seasonal and limited. Enormous, rich yolks — outstanding for baking.', price: 6.00, category: 'Eggs', unit: 'per 4', farm: demoFarm._id, imageUrl: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?w=400' },
  ];
  await Product.insertMany(farmProducts);
  console.log(`Inserted ${farmProducts.length} farm products for Meadow View Farm`);

  await mongoose.disconnect();
  console.log('Done!');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
