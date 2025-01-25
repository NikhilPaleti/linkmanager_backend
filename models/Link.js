const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema({
    click_time: { type: Date, default: Date.now },
    ip_addr: { type: String, required: true },
    user_device: { type: String, required: true }
});

const linkSchema = new mongoose.Schema({
    original_link: { type: String, required: true },
    short_link: { type: String, required: true, unique: true, length: 8 },
    remarks: { type: String },
    expiry_date: { type: Date },
    owner: { type: String, required: true },
    clicks: { type: Array, default: [] }
});

const Link = mongoose.model('Link', linkSchema, 'p2links');

module.exports = Link; 