require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || '';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'webhook2026';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ACTIVIX_API_KEY = process.env.ACTIVIX_API_KEY || '';

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  console.log('Token recu:', token);
  console.log('Token attendu:', VERIFY_TOKEN);
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verifie!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  if (body.object !== 'page') return;
  for (const entry of body.entry) {
    for (const event of entry.messaging) {
      if (!event.message || !event.message.text) continue;
      const senderId = event.sender.id;
      const messageText = event.message.text;
      console.log('Message recu de ' + senderId + ': ' + messageText);
      const aiResponse = await getClaudeResponse(messageText);
      await sendMessengerMessage(senderId, aiResponse);
      await createActivixLead(senderId, messageText);
    }
  }
});

async function getClaudeResponse(userMessage) {
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'Tu es un agent IA specialise en vente automobile pour Hyundai St-Raymond, un concessionnaire quebecois. Tu reponds en francais canadien, tu es chaleureux et professionnel. Tu veux toujours obtenir les coordonnees du client et planifier un essai routier ou rendez-vous. Sois concis (2-3 phrases max).',
        messages: [{ role: 'user', content: userMessage }],
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.content[0].text;
  } catch (error) {
    console.error('Erreur Claude:', error.message);
    return 'Merci pour votre message! Un de nos conseillers vous contactera tres bientot.';
  }
}

async function sendMessengerMessage(recipientId, message) {
  try {
    await axios.post(
      'https://graph.facebook.com/v21.0/me/messages',
      {
        recipient: { id: recipientId },
        message: { text: message },
      },
      {
        params: { access_token: PAGE_ACCESS_TOKEN },
      }
    );
    console.log('Reponse envoyee a ' + recipientId);
  } catch (error) {
    console.error('Erreur Messenger:', error.message);
  }
}

async function createActivixLead(senderId, message) {
  try {
    await axios.post(
      'https://api.activixcrm.com/v2/leads',
      {
        source: 'Facebook Messenger',
        comment: message,
        customer: { facebook_id: senderId },
      },
      {
        headers: {
          Authorization: 'Bearer ' + ACTIVIX_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('Lead cree dans Activix');
  } catch (error) {
    console.error('Erreur Activix:', error.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Serveur demarre sur le port ' + PORT);
});
