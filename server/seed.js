/**
 * Database seed — run with: node server/seed.js
 * Clears all collections and inserts demo data.
 * DO NOT run against a production database.
 */

require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const Product = require('./models/Product');
const Centre  = require('./models/Centre');
const User    = require('./models/User');
const Order   = require('./models/Order');

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

// Platform products (admin-created, no farm link, no imageUrl — add via dashboard)
const platformProducts = [
  // Dairy
  { name: 'Whole Milk',       description: 'Full-fat unhomogenised milk from grass-fed Jerseys. Cream line guaranteed.',        price: 1.45, category: 'Dairy',      unit: 'per litre',   featured: true,  stock: 100 },
  { name: 'Mature Cheddar',   description: 'Aged 18 months on the farm. Crumbly, sharp, and deeply savoury.',                   price: 6.50, category: 'Dairy',      unit: 'per 300g',    stock: 40 },
  { name: 'Salted Butter',    description: 'Churned slowly from cultured cream. Rich golden colour.',                           price: 3.20, category: 'Dairy',      unit: 'per 250g',    stock: 60 },
  { name: 'Natural Yoghurt',  description: 'Thick, creamy yoghurt made with live cultures. No additives.',                     price: 2.80, category: 'Dairy',      unit: 'per 500g',    stock: 50 },
  // Beef
  { name: 'Ribeye Steak',     description: 'Dry-aged 28 days. Exceptional marbling from our Hereford herd.',                   price: 18.00, category: 'Beef',      unit: 'per 300g',    featured: true,  stock: 20 },
  { name: 'Beef Mince',       description: '20% fat mince from shoulder and chuck. Perfect for bolognese.',                    price: 7.50, category: 'Beef',       unit: 'per 500g',    stock: 45 },
  { name: 'Beef Brisket',     description: 'Slow-roast cut, deeply flavourful. Ideal for low and slow cooking.',               price: 12.00, category: 'Beef',      unit: 'per kg',      stock: 15 },
  { name: 'Sirloin Steak',    description: 'Classic Sunday steak. Lean with a generous fat cap.',                              price: 15.00, category: 'Beef',      unit: 'per 250g',    stock: 18 },
  // Pork
  { name: 'Back Bacon Rashers', description: 'Outdoor-bred, dry-cured for 5 days. No water added.',                           price: 5.50, category: 'Pork',       unit: 'per 250g',    featured: true,  stock: 55 },
  { name: 'Pork Sausages',    description: '85% pork, coarsely ground with herbs. Six per pack.',                              price: 5.00, category: 'Pork',       unit: 'per 450g',    stock: 60 },
  { name: 'Pork Belly',       description: 'Five-layer belly, ideal for crackling roasts or slow braises.',                    price: 9.00, category: 'Pork',       unit: 'per kg',      stock: 25 },
  { name: 'Pork Shoulder Joint', description: 'Bone-in shoulder. Slow-cook for 6 hours for pulled pork perfection.',          price: 14.00, category: 'Pork',      unit: 'per 1.5kg',   stock: 10 },
  // Vegetables
  { name: 'Seasonal Veg Box', description: 'Eight varieties of whatever is best this week. Harvested the morning of delivery.', price: 12.00, category: 'Vegetables', unit: 'per box',  featured: true,  stock: 20 },
  { name: 'New Potatoes',     description: 'Waxy Charlotte variety. Boil, steam or roast.',                                   price: 2.50, category: 'Vegetables', unit: 'per kg',      stock: 3 },
  { name: 'Salad Leaves Mix', description: 'Peppery rocket, little gem, and spinach. Washed and ready.',                      price: 2.20, category: 'Vegetables', unit: 'per 100g',    stock: 30 },
  { name: 'Heritage Carrots', description: 'Purple, yellow and orange varieties. Sweeter than supermarket carrots.',           price: 1.80, category: 'Vegetables', unit: 'per bunch',   stock: 40 },
  // Eggs
  { name: 'Free-Range Eggs',  description: "Large hens' eggs from our mixed flock. Bright golden yolks.",                     price: 3.00, category: 'Eggs',       unit: 'per dozen',   featured: true,  stock: 70 },
  { name: 'Duck Eggs',        description: 'Rich, creamy duck eggs. Superb for baking and scrambling.',                       price: 4.50, category: 'Eggs',       unit: 'per 6',       stock: 0 },
  // Poultry
  { name: 'Whole Chicken',    description: 'Slowly grown, corn-fed. Exceptional flavour and texture. ~1.8kg.',                price: 14.00, category: 'Poultry',   unit: 'each',        featured: true,  stock: 22 },
  { name: 'Chicken Thighs',   description: 'Bone-in, skin-on thighs. The most flavourful cut for everyday cooking.',          price: 6.50, category: 'Poultry',   unit: 'per 500g',    stock: 35 },
  { name: 'Chicken Breast Fillets', description: 'Plump, lean fillets from free-range birds. Two per pack.',                 price: 7.00, category: 'Poultry',   unit: 'per 2',       stock: 30 },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  await Promise.all([
    Centre.deleteMany({}),
    Product.deleteMany({}),
    User.deleteMany({}),
    Order.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  // ── Centres ──────────────────────────────────────────────────────────────
  const [londonCentre, manchesterCentre] = await Centre.insertMany(centres);
  console.log(`Inserted ${centres.length} centres`);

  // ── Platform products ─────────────────────────────────────────────────────
  const inserted = await Product.insertMany(platformProducts);
  console.log(`Inserted ${inserted.length} platform products`);

  // ── Admin ─────────────────────────────────────────────────────────────────
  await new User({
    name: 'Farm Admin',
    email: 'admin@thefarmgate.co.uk',
    password: 'Admin1234!',
    role: 'admin',
  }).save();
  console.log('Created admin: admin@thefarmgate.co.uk / Admin1234!');

  // ── Demo farms ────────────────────────────────────────────────────────────
  const farm1 = await new User({
    name: 'Alice Green',
    email: 'meadowview@thefarmgate.co.uk',
    password: 'Farm1234!',
    role: 'farm',
    farmName: 'Meadow View Farm',
    farmDescription:
      'A family-run mixed farm in the heart of Shropshire. We raise rare-breed cattle ' +
      'and grow heritage vegetables using traditional, low-input methods.',
    farmLocation: 'Shropshire, UK',
  }).save();

  const farm2 = await new User({
    name: 'Rob Harding',
    email: 'oakridge@thefarmgate.co.uk',
    password: 'Farm1234!',
    role: 'farm',
    farmName: 'Oak Ridge Organics',
    farmDescription:
      'Certified organic smallholding in the Surrey Hills. We rear free-range pigs ' +
      'and laying hens on woodland pasture, and grow a wide range of seasonal vegetables ' +
      'without pesticides or artificial fertilisers.',
    farmLocation: 'Surrey Hills, Surrey',
  }).save();

  const farm3 = await new User({
    name: 'Fiona Marsh',
    email: 'marshlanddairy@thefarmgate.co.uk',
    password: 'Farm1234!',
    role: 'farm',
    farmName: 'Marshland Dairy',
    farmDescription:
      'Specialist dairy farm on the Somerset Levels. Our Friesian-cross herd graze ' +
      'year-round on herb-rich permanent pasture. We produce milk, butter, and a ' +
      'selection of soft and aged cheeses all made on-site.',
    farmLocation: 'Somerset Levels, Somerset',
  }).save();

  console.log('Created 3 demo farms');

  await Product.insertMany([
    // Meadow View Farm
    { name: 'Longhorn Ribeye',      description: 'From our small Longhorn herd. Dry-aged 35 days for maximum depth.',         price: 22.00, category: 'Beef',       unit: 'per 300g',  featured: true,  farmFeatured: true, farm: farm1._id, stock: 12 },
    { name: 'Raw Jersey Milk',      description: 'Unhomogenised, non-pasteurised. Only available for collection.',            price: 1.80,  category: 'Dairy',      unit: 'per litre',              farmFeatured: true, farm: farm1._id, stock: 50 },
    { name: 'Mixed Salad Bag',      description: 'Cut fresh on delivery day from our polytunnel. Eight varieties.',           price: 2.50,  category: 'Vegetables', unit: 'per 150g',               farmFeatured: true, farm: farm1._id, stock: 20 },
    { name: 'Goose Eggs',           description: 'Seasonal and limited. Enormous, rich yolks — outstanding for baking.',      price: 6.00,  category: 'Eggs',       unit: 'per 4',                  farmFeatured: true, farm: farm1._id, stock: 5  },
    // Oak Ridge Organics
    { name: 'Woodland Pork Chops',  description: 'Thick-cut chops from our woodland-reared pigs. Exceptional flavour.',      price: 9.50,  category: 'Pork',       unit: 'per 2',     featured: true,  farmFeatured: true, farm: farm2._id, stock: 18 },
    { name: 'Organic Pork Mince',   description: 'Lean, coarsely ground pork. Ideal for meatballs or ragù.',                 price: 6.00,  category: 'Pork',       unit: 'per 500g',               farmFeatured: true, farm: farm2._id, stock: 30 },
    { name: 'Hen Eggs (Organic)',   description: 'Certified organic free-range eggs. Vivid yolks and firm whites.',          price: 4.20,  category: 'Eggs',       unit: 'per dozen',              farmFeatured: true, farm: farm2._id, stock: 55 },
    { name: 'Courgettes',           description: 'Mixed green and yellow courgettes, harvested small for best flavour.',     price: 2.00,  category: 'Vegetables', unit: 'per 500g',               farmFeatured: true, farm: farm2._id, stock: 25 },
    { name: 'Kale Bunch',           description: 'Curly kale, picked fresh. Rich in iron and deeply savoury.',               price: 1.60,  category: 'Vegetables', unit: 'per bunch',                                  farm: farm2._id, stock: 0  },
    // Marshland Dairy
    { name: 'Soft Goat Cheese',     description: 'Delicate, lightly salted fresh curd. Pairs well with honey or beetroot.',  price: 5.50,  category: 'Dairy',      unit: 'per 150g',  featured: true,  farmFeatured: true, farm: farm3._id, stock: 22 },
    { name: 'Farmhouse Butter',     description: 'Slow-churned from our own cream. Unsalted and salted versions available.', price: 3.80,  category: 'Dairy',      unit: 'per 250g',               farmFeatured: true, farm: farm3._id, stock: 40 },
    { name: 'Aged Hard Cheese',     description: 'Pressed and matured for 9 months. Nutty, complex and deeply satisfying.',  price: 9.00,  category: 'Dairy',      unit: 'per 350g',               farmFeatured: true, farm: farm3._id, stock: 15 },
    { name: 'Full-Fat Cream',       description: 'Thick pouring cream straight from the dairy. 40% fat.',                   price: 2.60,  category: 'Dairy',      unit: 'per 250ml',                                  farm: farm3._id, stock: 3  },
  ]);
  console.log('Inserted farm products for all 3 farms');

  // ── Demo customers ────────────────────────────────────────────────────────
  const customer1 = await new User({
    name: 'Sam Taylor',
    email: 'sam@example.com',
    password: 'Password1!',
    role: 'customer',
    postcode: 'SW16 3AB',
    assignedCentre: londonCentre._id,
  }).save();

  const customer2 = await new User({
    name: 'Jo Williams',
    email: 'jo@example.com',
    password: 'Password1!',
    role: 'customer',
    postcode: 'M20 5QR',
    assignedCentre: manchesterCentre._id,
  }).save();
  console.log('Created 2 demo customers');

  // ── Demo orders ───────────────────────────────────────────────────────────
  const [milk, ribeye, eggs, sausages, chicken] = [
    inserted[0],  // Whole Milk
    inserted[4],  // Ribeye Steak
    inserted[16], // Free-Range Eggs
    inserted[9],  // Pork Sausages
    inserted[18], // Whole Chicken
  ];

  await Order.insertMany([
    {
      user: customer1._id,
      centre: londonCentre._id,
      items: [
        { product: milk._id,   name: milk.name,   price: milk.price,   quantity: 4 },
        { product: ribeye._id, name: ribeye.name, price: ribeye.price, quantity: 1 },
      ],
      total: milk.price * 4 + ribeye.price,
      status: 'delivered',
    },
    {
      user: customer1._id,
      centre: londonCentre._id,
      items: [
        { product: eggs._id,     name: eggs.name,     price: eggs.price,     quantity: 2 },
        { product: chicken._id,  name: chicken.name,  price: chicken.price,  quantity: 1 },
      ],
      total: eggs.price * 2 + chicken.price,
      status: 'confirmed',
    },
    {
      user: customer2._id,
      centre: manchesterCentre._id,
      items: [
        { product: sausages._id, name: sausages.name, price: sausages.price, quantity: 3 },
        { product: eggs._id,     name: eggs.name,     price: eggs.price,     quantity: 1 },
      ],
      total: sausages.price * 3 + eggs.price,
      status: 'pending',
    },
  ]);
  console.log('Created 3 demo orders');

  await mongoose.disconnect();
  console.log('\n── Seed complete ──────────────────────────────────────────');
  console.log('Admin:      admin@thefarmgate.co.uk         /  Admin1234!');
  console.log('Farm 1:     meadowview@thefarmgate.co.uk    /  Farm1234!');
  console.log('Farm 2:     oakridge@thefarmgate.co.uk      /  Farm1234!');
  console.log('Farm 3:     marshlanddairy@thefarmgate.co.uk  /  Farm1234!');
  console.log('Customer 1: sam@example.com  /  Password1!');
  console.log('Customer 2: jo@example.com  /  Password1!');
  console.log('──────────────────────────────────────────────────────────\n');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
