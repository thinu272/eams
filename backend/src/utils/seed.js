require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/eams');
  console.log('MongoDB connected for seeding...');
};

const seed = async () => {
  await connectDB();
  await User.deleteMany({});
  await Event.deleteMany({});
  console.log('Cleared existing data.');

  const admin = await User.create({
    name: 'System Admin', email: process.env.SEED_ADMIN_EMAIL || 'admin@eams.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123456', role: 'main_admin', isActive: true,
  });

  const organiser = await User.create({
    name: 'Roshan Perera', email: 'organiser@eams.com', password: 'Organiser@123',
    role: 'main_organiser', isActive: true, createdBy: admin._id,
  });

  const subOrg = await User.create({
    name: 'Nimali Silva', email: 'suborg@eams.com', password: 'SubOrg@123',
    role: 'sub_organiser', isActive: true, createdBy: organiser._id,
    permissions: { canAddAttendees: true, canBulkUpload: true, canVerifyPhotos: true, canInviteAttendees: true, canViewReports: true, canManageStaff: false },
  });

  const staff = await User.create({
    name: 'Kamal Bandara', email: 'staff@eams.com', password: 'Staff@123',
    role: 'staff', isActive: true, assignedGates: ['Gate A', 'Gate B'], createdBy: organiser._id,
  });

  const event = await Event.create({
    name: 'The Big Match 2025', slug: 'the-big-match-2025', description: 'The most anticipated cricket match of the year at R. Premadasa Stadium.',
    eventType: 'cricket',
    venue: { name: 'R. Premadasa International Cricket Stadium', address: 'Khettarama Road', city: 'Colombo', country: 'Sri Lanka' },
    startDate: new Date('2025-07-15T08:00:00Z'), endDate: new Date('2025-07-17T20:00:00Z'),
    gatesOpenTime: new Date('2025-07-15T06:00:00Z'), status: 'published', publishedAt: new Date(),
    matchDetails: { teamA: 'Royal College', teamB: "S. Thomas' College", matchType: 'Two-Day', series: 'Battle of the Maroons 2025' },
    categories: [
      { id: 'vvip', name: 'VVIP', description: 'Exclusive hospitality suite', price: 25000, capacity: 100, sold: 0, color: '#7C3AED', allowedZones: ['vvip-suite','vip-lounge','premium-stand','general-stand','media-center'], benefits: ['VVIP Suite','Gourmet dining','Priority parking','All areas access'] },
      { id: 'vip', name: 'VIP', description: 'Premium pavilion seating', price: 12000, capacity: 500, sold: 0, color: '#2563EB', allowedZones: ['vip-lounge','premium-stand','general-stand'], benefits: ['VIP Pavilion','Lounge access','Complimentary refreshments'] },
      { id: 'general', name: 'General Admission', description: 'Standard seating', price: 3500, capacity: 5000, sold: 0, color: '#16A34A', allowedZones: ['general-stand'], benefits: ['General stand access','Match programme'] },
      { id: 'school', name: 'School / Student', description: 'Student block', price: 1500, capacity: 3000, sold: 0, color: '#D97706', allowedZones: ['school-block'], benefits: ['School block seating','Student ID required'] },
      { id: 'media', name: 'Media / Press', description: 'Press accreditation', price: 0, capacity: 200, sold: 0, color: '#DC2626', allowedZones: ['media-center','press-box','general-stand'], benefits: ['Press box','Media centre','Interview zone'] },
    ],
    zones: [
      { id: 'vvip-suite', name: 'VVIP Hospitality Suite', capacity: 100, color: '#7C3AED' },
      { id: 'vip-lounge', name: 'VIP Lounge', capacity: 600, color: '#2563EB' },
      { id: 'premium-stand', name: 'Premium Stand', capacity: 1000, color: '#0891B2' },
      { id: 'general-stand', name: 'General Stand', capacity: 5000, color: '#16A34A' },
      { id: 'school-block', name: 'School Block', capacity: 3000, color: '#D97706' },
      { id: 'media-center', name: 'Media Centre', capacity: 200, color: '#DC2626' },
      { id: 'press-box', name: 'Press Box', capacity: 50, color: '#9333EA' },
    ],
    mainOrganiser: organiser._id, subOrganisers: [subOrg._id], staff: [staff._id],
    settings: { requirePhotoVerification: true, allowSelfConfirmation: true, confirmationDeadlineHours: 72, maxTicketsPerOrder: 10, rfidEnabled: true },
    createdBy: admin._id,
  });

  await User.updateMany({ _id: { $in: [organiser._id, subOrg._id, staff._id] } }, { $addToSet: { assignedEvents: event._id } });

  console.log('\n=== SEED COMPLETE ===');
  console.log('  Main Admin:     admin@eams.com      / Admin@123456');
  console.log('  Main Organiser: organiser@eams.com  / Organiser@123');
  console.log('  Sub Organiser:  suborg@eams.com     / SubOrg@123');
  console.log('  Staff:          staff@eams.com      / Staff@123');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
