/**
 * @license
 *
 * UpFish - dynamically making fun of your movies
 * Copyright (C) 2021 Joey Parrish
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @fileoverview
 *
 * This is a simple counter service (if something this long can be called
 * "simple") that runs on express JS.  When started, it will accept requests
 * from the UpFish extension to count the number of installs and the number of
 * sessions per day.  No other information is stored.
 *
 * This is done with a simple service and MySQL running in Heroku.  We could
 * have used Google Analytics, but this is transparent and open and more in the
 * spirit of open source.  You can see exactly what information we collect and
 * how.
 */

const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('promise-mysql');
const path = require('path');

const port = process.env.PORT || 5000;
const dbUrl = new URL(process.env.DATABASE_URL);
const expectedToken = process.env.EXPECTED_TOKEN;

const INSTALL_COUNTER_ID = 0;
const SESSION_COUNTER_ID = 1;

const app = express();
app.use(bodyParser.json());

(async () => {
  // Connect to the database.
  const pool = await mysql.createPool({
    host: dbUrl.host,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.substr(1),
    connectionLimit: 5,  // This feels terribly arbitrary.
  });

  const connection = await pool.getConnection();
  try {
    initDatabase(connection);
  } finally {
    connection.release();
  }

  async function initDatabase(connection) {
    // The initial setup should be done in a transaction.
    await connection.beginTransaction();

    try {
      // Check if we have created the table yet.
      const ret = await connection.query(
          `SELECT * FROM information_schema.tables
          WHERE table_name = 'counters';`);

      if (ret.length) {
        console.log('Counter table exists.');
      } else {
        console.log('Creating counter table.');

        await connection.query(
            `CREATE TABLE counters (
              id INT NOT NULL,
              day DATE NOT NULL,
              value INT NOT NULL,
              CONSTRAINT composite_key PRIMARY KEY (id, day)
            ) ENGINE=INNODB;`);
        await connection.commit();

        console.log('Counter table created.');
      }
    } catch (err) {
      console.log('Error during init:', err);
      await connection.rollback();
    }
  }

  async function incrementCounter(id, req, res) {
    // Prevent casual or accidental spam.  This is not actual security.
    if (req.body.token != expectedToken) {
      console.error('Wrong token or no token');
      console.error('Body:', req.body);
      console.error('Expected:', expectedToken);
      res.send('ERROR!\n');
      return;
    }

    let connection;
    try {
      // Read the value and update it in one transaction.
      // Using select for update allows us to lock the row down and prevent a
      // race condition.
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [row] = await connection.query(
          `SELECT value FROM counters WHERE id = ? AND day = CURDATE() FOR UPDATE;`,
          [id]);
      const value = row ? row.value + 1 : 1;
      await connection.query(
          `INSERT INTO counters (id, day, value) VALUES (?, CURDATE(), ?)
          ON DUPLICATE KEY UPDATE value = ?`,
          [id, value, value]);
      await connection.commit();

      res.send(`OK: ${value}\n`);
    } catch (error) {
      console.error('Error on increment:', error);
      res.send('ERROR!\n');
    } finally {
      connection.release();
    }
  }

  async function createSvgCounter(id, label, color, res) {
    let value;

    try {
      const [row] = await pool.query(
          `SELECT SUM(value) AS total FROM counters WHERE id = ?;`,
          [id]);
      value = row.total || 0;
    } catch (error) {
      console.error('Error on SVG counter:', error);
      value = 'Database error!';
    }

    // Leverage the shields.io service to generate an SVG for us.
    res.redirect(`https://img.shields.io/badge/${label}-${value}-${color}`);
  }

  async function createSvgChart(id, res) {
    try {
      const rows = await pool.query(
          `SELECT DATE_FORMAT(day, "%Y-%m-%d") as day, value FROM counters WHERE id = ? ORDER BY day ASC;`,
          [id]);

      const values = rows.map((r) => r.value);
      // Adding a little padding keeps the max value from being cut off at the
      // top of the chart.
      const maxValue = Math.max.apply(null, values) * 1.05;

      let html = '';

      html += '<html><head>';
      html += '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/charts.css/dist/charts.min.css">';
      html += '<style>';
      html += '#table { --line-size: 8px; padding: 0 24px; }';
      html += '#table th { width: 5em; font-size: 70%; margin-left: 50%; }';
      html += '#table span.data { text-align: center; width: 4em; }';
      html += '</style>';
      html += '</head><body>';
      html += '<table id="table" class="charts-css line show-data-on-hover show-labels show-primary-axis">';
      html += '<tbody>';

      const groupSize = Math.ceil(rows.length / 10);

      for (let i = 0; i < rows.length; ++i) {
        let header = '';
        if (i % groupSize == 0) {
          header = `<th scope="row">${rows[i].day}</th>`;
        }

        const current = rows[i].value;
        const previous = i > 0 ? rows[i - 1].value : 0;

        let data = '<tr>';
        data += header;
        data += `<td style="--start: ${previous / maxValue}; --size: ${current / maxValue}">`;
        data += `<span class="data">${current}</span>`;
        data += '</td>';
        data += '</tr>';

        html += data;
      }

      html += '</tbody></table>';
      html += '</body></html>';

      res.set('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error('Error on chart:', error);
      res.status(500).send('Error!');
    }
  }

  app.post('/install-counter', (req, res) => {
    incrementCounter(INSTALL_COUNTER_ID, req, res);
  });

  app.post('/session-counter', (req, res) => {
    incrementCounter(SESSION_COUNTER_ID, req, res);
  });

  app.get('/num-installs', (req, res) => {
    createSvgCounter(INSTALL_COUNTER_ID, 'installations', 'blue', res);
  });

  app.get('/num-sessions', (req, res) => {
    createSvgCounter(SESSION_COUNTER_ID, 'sessions', 'brightgreen', res);
  });

  app.get('/install-chart.html', (req, res) => {
    createSvgChart(INSTALL_COUNTER_ID, res);
  });

  app.get('/session-chart.html', (req, res) => {
    createSvgChart(SESSION_COUNTER_ID, res);
  });

  app.get('/debug.html', (req, res) => {
    res.set('Content-Type', 'text/html');
    res.sendFile(__dirname + '/debug.html');
  });

  app.get('/upfish.svg', (req, res) => {
    res.set('Content-Type', 'image/svg+xml');
    res.sendFile(path.dirname(__dirname) + '/upfish.svg');
  });

  // A nuclear option to wipe the DB.  Used during early development of the
  // service, but commented out in production.
  /*
  app.post('/wipe-db', async (req, res) => {
    await pool.query('DROP TABLE counters;');
    res.send('OK');
  });
  // */

  const server = app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
})();
