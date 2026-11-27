require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mysql = require('mysql2/promise');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true
});

app.get('/health', async (req, res) => {
  try { await db.query('SELECT 1'); res.json({status:'ok', database:'connected'}); }
  catch (err) { res.status(503).json({status:'error', database:'unavailable'}); }
});

    app.get('/api/categories', async (req,res) => {
  const [rows]=await db.query('SELECT * FROM expense_categories ORDER BY name'); res.json(rows);
});
app.post('/api/categories', async (req,res) => {
  const {name}=req.body; if(!name) return res.status(400).json({error:'name is required'});
  const [r]=await db.execute('INSERT INTO expense_categories(name) VALUES(?)',[name]);
  res.status(201).json({id:r.insertId});
});
app.get('/api/expenses', async (req,res) => {
  const {from,to,category_id}=req.query; const clauses=[],values=[];
  if(from){clauses.push('expense_date>=?');values.push(from);}
  if(to){clauses.push('expense_date<=?');values.push(to);}
  if(category_id){clauses.push('category_id=?');values.push(category_id);}
  const sql='SELECT e.*,c.name AS category FROM expenses e LEFT JOIN expense_categories c ON c.id=e.category_id'+(clauses.length?' WHERE '+clauses.join(' AND '):'')+' ORDER BY expense_date DESC,e.id DESC';
  const [rows]=await db.execute(sql,values); res.json(rows);
});
app.post('/api/expenses', async (req,res) => {
  const {title,amount,expense_date,category_id=null,payment_method='other',notes=null}=req.body;
  if(!title || !Number.isFinite(Number(amount)) || Number(amount)<=0 || !expense_date || !['cash','card','upi','bank','other'].includes(payment_method))
    return res.status(400).json({error:'Valid title, positive amount, date and payment_method required'});
  const [r]=await db.execute('INSERT INTO expenses(title,amount,expense_date,category_id,payment_method,notes) VALUES(?,?,?,?,?,?)',[title,amount,expense_date,category_id,payment_method,notes]);
  res.status(201).json({id:r.insertId,message:'Expense recorded'});
});
app.patch('/api/expenses/:id', async (req,res) => {
  const allowed=['title','amount','expense_date','category_id','payment_method','notes'];
  const fields=allowed.filter(k=>req.body[k]!==undefined);
  if(!fields.length) return res.status(400).json({error:'No fields supplied'});
  if(req.body.amount!==undefined && Number(req.body.amount)<=0) return res.status(400).json({error:'amount must be positive'});
  const [r]=await db.execute(`UPDATE expenses SET ${fields.map(k=>`${k}=?`).join(',')} WHERE id=?`,[...fields.map(k=>req.body[k]),req.params.id]);
  if(!r.affectedRows) return res.status(404).json({error:'Expense not found'});
  res.json({message:'Expense updated'});
});
app.delete('/api/expenses/:id', async (req,res) => {
  const [r]=await db.execute('DELETE FROM expenses WHERE id=?',[req.params.id]);
  if(!r.affectedRows) return res.status(404).json({error:'Expense not found'});
  res.status(204).end();
});
app.get('/api/reports/monthly', async (req,res) => {
  const [rows]=await db.query(`SELECT DATE_FORMAT(expense_date,'%Y-%m') AS month, SUM(amount) AS total FROM expenses GROUP BY month ORDER BY month DESC`);
  res.json(rows);
});

app.use((req,res) => res.status(404).json({error:'Route not found'}));
app.use((err,req,res,next) => {
  console.error(err);
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({error:'A record with this unique value already exists'});
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({error:'Referenced record does not exist'});
  res.status(500).json({error:'Internal server error'});
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
