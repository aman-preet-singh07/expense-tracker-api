#  Expense Tracker Api

Personal/business expense API with categories, monthly summaries and date filtering.

## Setup
1. Install Node.js 20+ and MySQL 8+.
2. Create a database:
   ```sql
   CREATE DATABASE 04_expense_tracker_api;
   ```
3. Import `schema.sql` into that database.
4. Copy `.env.example` to `.env` and update your MySQL password.
5. Install dependencies and start:
   ```bash
   npm install
   npm run dev
   ```
6. Test `GET http://localhost:3000/health`.

## API routes
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

## Notes
- Send and receive JSON.
- SQL values are parameterized.
- Do not expose your `.env` file or commit secrets.
- This is a portfolio starter, not a production-ready system. Add authentication, role-based authorization, tests, rate limits, pagination and deployment before real customer use.
