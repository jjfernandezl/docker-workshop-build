const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');

// Read the password from the secret file
let dbPassword;
try {
  dbPassword = fs.readFileSync('/run/secrets/db-password', 'utf8').trim();
} catch (err) {
  console.error('Error: Failed to read the database password from /run/secrets/db-password');
  process.exit(1);
}

// Database connection configuration
const dbConfig = {
  host: 'db',
  port: 5432,
  user: 'postgres',
  password: dbPassword,
  database: 'example'
};

const pool = new Pool(dbConfig);
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple HTML escaping function - MOVED UP HERE
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Initialize database
const initializeDatabase = async () => {
  try {
    const client = await pool.connect();
    const tableExistsResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'guestbook'
      );
    `);

    const tableExists = tableExistsResult.rows[0].exists;

    if (!tableExists) {
      console.log('Initializing database...');
      await client.query(`
        CREATE TABLE guestbook (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Database initialized with guestbook table.');
    } else {
      console.log('Guestbook table already exists. No initialization needed.');
    }

    client.release();
  } catch (err) {
    console.error('Error initializing database:', err.message);
    process.exit(1);
  }
};

// Simple web interface
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM guestbook ORDER BY id DESC');
    const entries = result.rows;

    res.send(`
    <html>
    <body style="font-family: Arial; max-width: 600px; margin: 50px auto;">
      <h1>Guestbook JJ</h1>
      
      <form method="POST" action="/add" style="background: #f5f5f5; padding: 20px; margin-bottom: 20px;">
        <input name="name" placeholder="Your name" required style="width: 100%; padding: 8px; margin: 5px 0;"><br>
        <textarea name="message" placeholder="Your message" required style="width: 100%; padding: 8px; margin: 5px 0; height: 60px;"></textarea><br>
        <button type="submit" style="padding: 10px 20px; background: #007bff; color: white; border: none;">Add Entry</button>
      </form>

      <h2>Entries (${entries.length})</h2>
      ${entries.map(e => `<div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0;"><b>${escapeHtml(e.name)}:</b> ${escapeHtml(e.message)}</div>`).join('')}
    </body>
    </html>`);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).send('Error: ' + err.message);
  }
});

// Handle form submission
app.post('/add', async (req, res) => {
  const { name, message } = req.body;
  
  if (!name || !message) {
    return res.status(400).send('Name and message are required');
  }

  try {
    await pool.query('INSERT INTO guestbook (name, message) VALUES ($1, $2)', [name, message]);
    res.redirect('/');
  } catch (err) {
    console.error('Error adding entry:', err.message);
    res.status(500).send('Failed to add entry');
  }
});

// API routes
app.get('/api/entries', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM guestbook ORDER BY created_at DESC');
    if (result.rows.length === 0) {
      return res.status(200).json({
        message: "Database connection was successful, but no records were found.",
      });
    }
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching guestbook entries:', err.message);
    res.status(500).json({ error: 'Failed to fetch guestbook entries' });
  }
});

app.post('/api/entries', async (req, res) => {
  const { name, message } = req.body;

  if (!name || !message) {
    return res.status(400).json({ error: 'Name and message are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO guestbook (name, message) VALUES ($1, $2) RETURNING *',
      [name, message]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding guestbook entry:', err.message);
    res.status(500).json({ error: 'Failed to add guestbook entry' });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to start the server:', err.message);
    process.exit(1);
  });