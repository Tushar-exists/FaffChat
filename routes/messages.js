const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { logger, logError } = require('../utils/logger');
const authMiddleware = require('../middleware/auth');

router.post('/messages', authMiddleware, async (req, res) => {
  const { receiverId, message } = req.body;
  const senderId = req.user.id;

  if (!receiverId || !message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid required fields: receiverId and message.' });
  }

  try {
    const newMessage = await Message.create({
      sender_id: senderId,
      receiver_id: receiverId,
      message: message.trim()
    });

    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers'); 

    const receiverSocketId = connectedUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('new_message', newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    logError(error, { context: 'POST /messages', senderId, receiverId });
    res.status(500).json({ error: 'An error occurred while sending the message.' });
  }
});

router.get('/messages/chats', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const chats = await Message.getRecentChats(userId);
    res.status(200).json(chats);
  } catch (error) {
    logError(error, { context: 'GET /messages/chats', userId });
    res.status(500).json({ error: 'Failed to retrieve recent chats.' });
  }
});

router.get('/messages/conversation', authMiddleware, async (req, res) => {
    const { otherUserId } = req.query;
    const currentUserId = req.user.id;

    if (!otherUserId || isNaN(parseInt(otherUserId))) {
        return res.status(400).json({ error: 'A valid `otherUserId` query parameter is required.' });
    }
    
    try {
        const messages = await Message.getConversation(currentUserId, parseInt(otherUserId));
        res.status(200).json(messages);
    } catch (error) {
        logError(error, { context: 'GET /messages/conversation', users: [currentUserId, otherUserId] });
        res.status(500).json({ error: 'Failed to retrieve conversation.' });
    }
});

router.get('/conversation/:otherUserId', authMiddleware, async (req, res) => {
  const currentUserId = req.user.id;
  const otherUserId = req.params.otherUserId;

  if (!otherUserId || isNaN(parseInt(otherUserId))) {
    return res.status(400).json({ error: 'A valid otherUserId path parameter is required.' });
  }

  try {
    const messages = await Message.getConversation(currentUserId, parseInt(otherUserId));
    res.status(200).json(messages);
  } catch (error) {
    logError(error, { context: 'GET /conversation/:otherUserId', users: [currentUserId, otherUserId] });
    res.status(500).json({ error: 'Failed to retrieve conversation.' });
  }
});

router.get('/messages/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  const userId = req.user.id;

  if (!q || typeof q !== 'string' || q.trim() === '') {
    return res.status(400).json({ error: 'A search query parameter `q` is required.' });
  }

  try {
    const results = await Message.semanticSearch(userId, q.trim());
    res.status(200).json(results);
  } catch (error) {
    logError(error, { context: 'GET /messages/search', userId, query: q });
    res.status(500).json({ error: 'Failed to perform semantic search.' });
  }
});

router.get('/semantic-search', authMiddleware, async (req, res) => {
  const { q, limit } = req.query;
  const userId = req.user.id;

  if (!q || typeof q !== 'string' || q.trim() === '') {
    return res.status(400).json({ error: 'A search query parameter `q` is required.' });
  }

  try {
    const results = await Message.semanticSearch(userId, q.trim(), limit ? parseInt(limit) : 10);
    res.status(200).json(results);
  } catch (error) {
    logError(error, { context: 'GET /semantic-search', userId, query: q });
    res.status(500).json({ error: 'Failed to perform semantic search.' });
  }
});

module.exports = router;