import { createChatwootAccount } from '../services/chatwoot';

export const createAccount = async (req, res) => {
  const { chatwootUserId, name } = req.body;

  if (!chatwootUserId) {
    return res.status(400).json({ error: 'chatwootUserId is required' });
  }

  try {
    const result = await createChatwootAccount(chatwootUserId, name);
    res.status(201).json({
      accountId: result.accountId,
      message: 'Chatwoot account created at platform level',
    });
  } catch (err) {
    res.status(502).json({
      error: 'Failed to create Chatwoot account',
      detail: err.response?.data || err.message,
    });
  }
};
