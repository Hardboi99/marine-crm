const { Activity, Notification, User } = require('../models');

/**
 * Log user activity in the database for audit trail & dashboard feed
 */
const logActivity = async ({ userId, entityType, entityId, action, details = null }) => {
  try {
    if (!userId || !entityType || !action) return;
    await Activity.create({
      userId,
      entityType,
      entityId: String(entityId || ''),
      action,
      details: details || undefined,
    });
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
};

/**
 * Send in-app notification to a user
 */
const createNotification = async ({ userId, type, message, link = null }) => {
  try {
    if (!userId || !type || !message) return;
    await Notification.create({
      userId,
      type,
      message,
      link,
    });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
};

/**
 * Broadcast notification to all Admin & Manager users
 */
const notifyAdminsAndManagers = async ({ type, message, link = null }) => {
  try {
    const users = await User.find({
      role: { $in: ['ADMIN', 'MANAGER'] },
      isActive: true,
    }).select('_id');

    const notifications = users.map((u) => ({
      userId: u._id,
      type,
      message,
      link,
    }));
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (err) {
    console.error('Failed to notify admins/managers:', err.message);
  }
};

module.exports = { logActivity, createNotification, notifyAdminsAndManagers };
