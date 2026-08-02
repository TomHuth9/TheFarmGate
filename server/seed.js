/**
 * Database seed — run with: npm run seed (from server/)
 * Wipes all collections and inserts realistic demo data.
 * Every product is linked to a farm — no orphaned documents.
 */

require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const Product  = require('./models/Product');
const Centre   = require('./models/Centre');
const User     = require('./models/User');
const Order    = require('./models/Order');

// ── Delivery centres ──────────────────────────────────────────────────────────
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

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // ── Wipe ──────────────────────────────────────────────────────────────────
  await Promise.all([
    Centre.deleteMany({}),
    Product.deleteMany({}),
    User.deleteMany({}),
    Order.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  // ── Centres ───────────────────────────────────────────────────────────────
  const [londonCentre, manchesterCentre] = await Centre.insertMany(centres);
  console.log(`Inserted ${centres.length} centres`);

  // ── Admin ─────────────────────────────────────────────────────────────────
  await new User({
    name: 'Farm Admin',
    email: 'admin@thefarmgate.co.uk',
    password: 'Admin1234!',
    role: 'admin',
    emailVerified: true,
  }).save();
  console.log('Created admin: admin@thefarmgate.co.uk / Admin1234!');

  // ── Farms ─────────────────────────────────────────────────────────────────
  // Postcodes are real UK postcodes so the postcode-discovery feature resolves them.

  const farm1 = await new User({
    name: 'Alice Green',
    email: 'meadowview@thefarmgate.co.uk',
    password: 'Farm1234!',
    role: 'farm',
    emailVerified: true,
    farmName: 'Meadow View Farm',
    farmDescription:
      'A family-run mixed farm in the heart of Shropshire. We raise rare-breed ' +
      'Hereford cattle and slow-grown poultry using traditional, low-input methods, ' +
      'and grow heritage vegetables in our walled kitchen garden.',
    farmLocation: 'Shropshire, UK',
    postcode: 'SY6 7DQ',
  }).save();

  const farm2 = await new User({
    name: 'Rob Harding',
    email: 'oakridge@thefarmgate.co.uk',
    password: 'Farm1234!',
    role: 'farm',
    emailVerified: true,
    farmName: 'Oak Ridge Organics',
    farmDescription:
      'Certified organic smallholding in the Surrey Hills. We rear free-range pigs ' +
      'and laying hens on permanent woodland pasture, and grow a wide range of ' +
      'seasonal vegetables without pesticides or artificial fertilisers.',
    farmLocation: 'Surrey Hills, Surrey',
    postcode: 'GU8 4JX',
  }).save();

  const farm3 = await new User({
    name: 'Fiona Marsh',
    email: 'marshlanddairy@thefarmgate.co.uk',
    password: 'Farm1234!',
    role: 'farm',
    emailVerified: true,
    farmName: 'Marshland Dairy',
    farmDescription:
      'Specialist dairy farm on the Somerset Levels. Our Friesian-cross herd graze ' +
      'year-round on herb-rich permanent pasture. We produce milk, cream, butter, ' +
      'and a selection of soft and aged cheeses all made on-site.',
    farmLocation: 'Somerset Levels, Somerset',
    postcode: 'TA7 9PQ',
  }).save();

  console.log('Created 3 farms');

  // ── Products ──────────────────────────────────────────────────────────────
  // All products belong to a farm — no farm: null entries.

  const meadowProducts = await Product.insertMany([
    // Beef
    {
      name: 'Ribeye Steak',
      description: 'From our small Hereford herd, dry-aged 28 days for exceptional marbling and flavour.',
      price: 18.00, category: 'Beef', unit: 'per 300g',
      featured: true, farmFeatured: true, farm: farm1._id, stock: 20,
    },
    {
      name: 'Sirloin Steak',
      description: 'Classic Sunday steak. Lean with a generous fat cap. Dry-aged 21 days.',
      price: 15.00, category: 'Beef', unit: 'per 250g',
      farmFeatured: true, farm: farm1._id, stock: 18,
    },
    {
      name: 'Beef Mince',
      description: '20% fat mince from shoulder and chuck. Perfect for bolognese or burgers.',
      price: 7.50, category: 'Beef', unit: 'per 500g',
      farm: farm1._id, stock: 45,
    },
    {
      name: 'Beef Brisket',
      description: 'Slow-roast cut from the chest, deeply flavourful. Ideal for low-and-slow cooking.',
      price: 12.00, category: 'Beef', unit: 'per kg',
      farm: farm1._id, stock: 15,
    },
    // Poultry
    {
      name: 'Whole Chicken',
      description: 'Slowly grown over 12 weeks, corn-finished. Exceptional flavour. Approx 1.8 kg.',
      price: 14.00, category: 'Poultry', unit: 'each',
      featured: true, farmFeatured: true, farm: farm1._id, stock: 22,
    },
    {
      name: 'Chicken Thighs',
      description: 'Bone-in, skin-on thighs from our slow-grown birds. The most flavourful cut.',
      price: 6.50, category: 'Poultry', unit: 'per 500g',
      farm: farm1._id, stock: 35,
    },
    {
      name: 'Chicken Breast Fillets',
      description: 'Plump, lean fillets from free-range birds. Two per pack.',
      price: 7.00, category: 'Poultry', unit: 'per 2',
      farm: farm1._id, stock: 30,
    },
    // Vegetables
    {
      name: 'Seasonal Veg Box',
      description: 'Eight varieties of whatever is best this week, harvested the morning of delivery.',
      price: 12.00, category: 'Vegetables', unit: 'per box',
      featured: true, farm: farm1._id, stock: 20,
    },
    {
      name: 'Heritage Carrots',
      description: 'Purple, yellow and orange varieties from the walled garden. Sweeter than supermarket carrots.',
      price: 1.80, category: 'Vegetables', unit: 'per bunch',
      farm: farm1._id, stock: 40,
    },
    {
      name: 'New Potatoes',
      description: 'Waxy Charlotte variety. Boil, steam or roast. Harvested the same day.',
      price: 2.50, category: 'Vegetables', unit: 'per kg',
      farm: farm1._id, stock: 30,
    },
    // Eggs
    {
      name: 'Free-Range Eggs',
      description: "Large hens' eggs from our mixed flock. Bright golden yolks guaranteed.",
      price: 3.00, category: 'Eggs', unit: 'per dozen',
      featured: true, farmFeatured: true, farm: farm1._id, stock: 70,
    },
    {
      name: 'Goose Eggs',
      description: 'Seasonal and limited. Enormous rich yolks — outstanding for baking and scrambling.',
      price: 6.00, category: 'Eggs', unit: 'per 4',
      farm: farm1._id, stock: 5,
    },
  ]);

  const oakProducts = await Product.insertMany([
    // Pork
    {
      name: 'Woodland Pork Chops',
      description: 'Thick-cut chops from our woodland-reared pigs. Exceptional flavour from slow rearing.',
      price: 9.50, category: 'Pork', unit: 'per 2',
      featured: true, farmFeatured: true, farm: farm2._id, stock: 18,
    },
    {
      name: 'Back Bacon Rashers',
      description: 'Outdoor-bred, dry-cured for 5 days. No water added. Unsmoked and smoked available.',
      price: 5.50, category: 'Pork', unit: 'per 250g',
      farmFeatured: true, farm: farm2._id, stock: 55,
    },
    {
      name: 'Pork Sausages',
      description: '85% pork, coarsely ground with thyme and nutmeg. Six per pack.',
      price: 5.00, category: 'Pork', unit: 'per 450g',
      farm: farm2._id, stock: 60,
    },
    {
      name: 'Organic Pork Mince',
      description: 'Lean, coarsely ground certified organic pork. Ideal for meatballs or ragù.',
      price: 6.00, category: 'Pork', unit: 'per 500g',
      farm: farm2._id, stock: 30,
    },
    {
      name: 'Pork Belly',
      description: 'Five-layer belly from our free-range pigs. Ideal for crackling roasts or slow braises.',
      price: 9.00, category: 'Pork', unit: 'per kg',
      farm: farm2._id, stock: 25,
    },
    {
      name: 'Pork Shoulder Joint',
      description: 'Bone-in shoulder. Slow-cook for 6 hours for pulled pork. Serves 6–8.',
      price: 14.00, category: 'Pork', unit: 'per 1.5 kg',
      farm: farm2._id, stock: 10,
    },
    // Eggs
    {
      name: 'Organic Hen Eggs',
      description: 'Certified organic free-range eggs from our woodland hens. Vivid yolks, firm whites.',
      price: 4.20, category: 'Eggs', unit: 'per dozen',
      farmFeatured: true, farm: farm2._id, stock: 55,
    },
    {
      name: 'Duck Eggs',
      description: 'Rich, creamy duck eggs from our Khaki Campbell flock. Superb for baking.',
      price: 4.50, category: 'Eggs', unit: 'per 6',
      farm: farm2._id, stock: 0,
    },
    // Vegetables
    {
      name: 'Salad Leaves Mix',
      description: 'Peppery rocket, little gem and spinach, grown without pesticides. Washed and ready.',
      price: 2.20, category: 'Vegetables', unit: 'per 100g',
      featured: true, farmFeatured: true, farm: farm2._id, stock: 30,
    },
    {
      name: 'Courgettes',
      description: 'Mixed green and yellow courgettes, harvested small for best flavour.',
      price: 2.00, category: 'Vegetables', unit: 'per 500g',
      farm: farm2._id, stock: 25,
    },
    {
      name: 'Kale Bunch',
      description: 'Curly kale picked fresh. Rich in iron and deeply savoury when wilted in butter.',
      price: 1.60, category: 'Vegetables', unit: 'per bunch',
      farm: farm2._id, stock: 0,
    },
  ]);

  const marshProducts = await Product.insertMany([
    // Dairy
    {
      name: 'Whole Milk',
      description: 'Full-fat unhomogenised milk from our grass-fed Friesian-cross herd. Cream line guaranteed.',
      price: 1.45, category: 'Dairy', unit: 'per litre',
      featured: true, farmFeatured: true, farm: farm3._id, stock: 100,
    },
    {
      name: 'Mature Cheddar',
      description: 'Pressed and aged 18 months in our on-farm dairy. Crumbly, sharp and deeply savoury.',
      price: 6.50, category: 'Dairy', unit: 'per 300g',
      farmFeatured: true, farm: farm3._id, stock: 40,
    },
    {
      name: 'Salted Butter',
      description: 'Churned slowly from our own cultured cream. Rich golden colour and clean finish.',
      price: 3.20, category: 'Dairy', unit: 'per 250g',
      farmFeatured: true, farm: farm3._id, stock: 60,
    },
    {
      name: 'Natural Yoghurt',
      description: 'Thick, creamy yoghurt made with live cultures from our own milk. No additives.',
      price: 2.80, category: 'Dairy', unit: 'per 500g',
      farm: farm3._id, stock: 50,
    },
    {
      name: 'Soft Goat Cheese',
      description: 'Delicate, lightly salted fresh curd made on-site. Pairs well with honey or beetroot.',
      price: 5.50, category: 'Dairy', unit: 'per 150g',
      featured: true, farm: farm3._id, stock: 22,
    },
    {
      name: 'Farmhouse Butter',
      description: 'Slow-churned from our own cream. Available unsalted and salted.',
      price: 3.80, category: 'Dairy', unit: 'per 250g',
      farm: farm3._id, stock: 40,
    },
    {
      name: 'Aged Hard Cheese',
      description: 'Pressed and matured for 9 months in the dairy. Nutty, complex and deeply satisfying.',
      price: 9.00, category: 'Dairy', unit: 'per 350g',
      farm: farm3._id, stock: 15,
    },
    {
      name: 'Full-Fat Cream',
      description: 'Thick pouring cream straight from the dairy. 40% fat. Outstanding with puddings.',
      price: 2.60, category: 'Dairy', unit: 'per 250ml',
      farm: farm3._id, stock: 35,
    },
    // Eggs — dairy farms typically keep hens too
    {
      name: 'Farmyard Eggs',
      description: "Mixed-flock hens roam freely across the dairy yard. Beautiful bright yolks.",
      price: 3.20, category: 'Eggs', unit: 'per dozen',
      farmFeatured: true, farm: farm3._id, stock: 45,
    },
  ]);

  const totalProducts = meadowProducts.length + oakProducts.length + marshProducts.length;
  console.log(`Inserted ${totalProducts} products across 3 farms (0 orphaned)`);

  // ── Demo customers ────────────────────────────────────────────────────────
  const customer1 = await new User({
    name: 'Sam Taylor',
    email: 'sam@example.com',
    password: 'Password1!',
    role: 'customer',
    emailVerified: true,
    postcode: 'SW16 3AB',
    assignedCentre: londonCentre._id,
  }).save();

  const customer2 = await new User({
    name: 'Jo Williams',
    email: 'jo@example.com',
    password: 'Password1!',
    role: 'customer',
    emailVerified: true,
    postcode: 'M20 5QR',
    assignedCentre: manchesterCentre._id,
  }).save();

  console.log('Created 2 demo customers');

  // ── Demo orders ───────────────────────────────────────────────────────────
  const [ribeye, chicken, eggs]   = [meadowProducts[0], meadowProducts[4], meadowProducts[10]];
  const [chops, sausages, salad]  = [oakProducts[0], oakProducts[2], oakProducts[8]];
  const [milk, cheddar, butter]   = [marshProducts[0], marshProducts[1], marshProducts[2]];

  await Order.insertMany([
    {
      user: customer1._id,
      centre: londonCentre._id,
      items: [
        { product: milk._id,   name: milk.name,   price: milk.price,   quantity: 4 },
        { product: ribeye._id, name: ribeye.name, price: ribeye.price, quantity: 1 },
        { product: eggs._id,   name: eggs.name,   price: eggs.price,   quantity: 2 },
      ],
      total: milk.price * 4 + ribeye.price + eggs.price * 2,
      status: 'delivered',
      deliveryAddress: { line1: '14 Harvest Close', city: 'London', postcode: 'SW16 3AB' },
    },
    {
      user: customer1._id,
      centre: londonCentre._id,
      items: [
        { product: chicken._id, name: chicken.name, price: chicken.price, quantity: 1 },
        { product: butter._id,  name: butter.name,  price: butter.price,  quantity: 2 },
        { product: salad._id,   name: salad.name,   price: salad.price,   quantity: 3 },
      ],
      total: chicken.price + butter.price * 2 + salad.price * 3,
      status: 'confirmed',
      deliveryAddress: { line1: '14 Harvest Close', city: 'London', postcode: 'SW16 3AB' },
    },
    {
      user: customer2._id,
      centre: manchesterCentre._id,
      items: [
        { product: sausages._id, name: sausages.name, price: sausages.price, quantity: 3 },
        { product: chops._id,    name: chops.name,    price: chops.price,    quantity: 2 },
        { product: cheddar._id,  name: cheddar.name,  price: cheddar.price,  quantity: 1 },
      ],
      total: sausages.price * 3 + chops.price * 2 + cheddar.price,
      status: 'pending',
      deliveryAddress: { line1: '8 Oak Street', city: 'Manchester', postcode: 'M20 5QR' },
    },
  ]);
  console.log('Created 3 demo orders');

  await mongoose.disconnect();

  const pad = (s) => s.padEnd(42);
  console.log('\n── Seed complete ──────────────────────────────────────────────');
  console.log(`${pad('Admin:')}             admin@thefarmgate.co.uk  /  Admin1234!`);
  console.log(`${pad('Meadow View Farm:')}  meadowview@thefarmgate.co.uk  /  Farm1234!`);
  console.log(`${pad('Oak Ridge Organics:')}oakridge@thefarmgate.co.uk  /  Farm1234!`);
  console.log(`${pad('Marshland Dairy:')}   marshlanddairy@thefarmgate.co.uk  /  Farm1234!`);
  console.log(`${pad('Customer (London):')} sam@example.com  /  Password1!`);
  console.log(`${pad('Customer (Mancs):')}  jo@example.com  /  Password1!`);
  console.log('────────────────────────────────────────────────────────────────');
  console.log(`Products: ${totalProducts} (${meadowProducts.length} Meadow View, ${oakProducts.length} Oak Ridge, ${marshProducts.length} Marshland)`);
  console.log('Orphaned products (farm: null): 0');
  console.log('────────────────────────────────────────────────────────────────\n');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
