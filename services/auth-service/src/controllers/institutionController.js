const mongoose = require('mongoose');
const Institution = require('../models/Institution');

exports.register = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const code = req.body.code?.trim().toUpperCase();
    const email = req.body.email?.trim().toLowerCase();

    if (!name || !code || !email) {
      return res.status(400).json({
        success: false,
        message: 'Institution name, code, and email are required.',
      });
    }

    const institution = await Institution.create({
      name,
      code,
      email,
      phone: req.body.phone?.trim(),
      address: req.body.address?.trim(),
      walletAddress: req.body.walletAddress?.trim(),
    });

    return res.status(201).json({
      success: true,
      message: 'Institution added and waiting for approval.',
      data: { institution },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Institution name or code already exists.' });
    }
    console.error('Register institution error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add institution.' });
  }
};

exports.list = async (_req, res) => {
  try {
    const institutions = await Institution.find().sort({ createdAt: -1 });
    return res.json({ success: true, data: { institutions } });
  } catch (error) {
    console.error('List institutions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve institutions.' });
  }
};

exports.approve = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid institution ID.' });
    }

    const institution = await Institution.findByIdAndUpdate(
      req.params.id,
      { isApproved: true, approvedBy: req.user.id, approvedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!institution) {
      return res.status(404).json({ success: false, message: 'Institution not found.' });
    }

    return res.json({ success: true, data: { institution } });
  } catch (error) {
    console.error('Approve institution error:', error);
    return res.status(500).json({ success: false, message: 'Failed to approve institution.' });
  }
};
