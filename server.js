const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Home page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Test MySQL connection
app.get("/api/test", (req, res) => {
    db.query("SELECT 1 AS result", (err, results) => {
        if (err) {
            console.error("MySQL test failed:", err.message);
            return res.status(500).json({
                error: "MySQL connection or query failed"
            });
        }

        res.json({
            message: "Book Management System connected to MySQL!",
            databaseTest: results[0].result
        });
    });
});

// GET: Retrieve all books
app.get("/api/books", (req, res) => {
    const sql = "SELECT * FROM books ORDER BY id DESC";

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching books:", err.message);
            return res.status(500).json({
                error: "Failed to fetch books"
            });
        }

        res.json(results);
    });
});

// GET: Retrieve one book by ID
app.get("/api/books/:id", (req, res) => {
    const sql = "SELECT * FROM books WHERE id = ?";

    db.query(sql, [req.params.id], (err, results) => {
        if (err) {
            console.error("Error fetching book:", err.message);
            return res.status(500).json({
                error: "Failed to fetch book"
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                error: "Book not found"
            });
        }

        res.json(results[0]);
    });
});

// POST: Add a new book
app.post("/api/books", (req, res) => {
    const {
        title,
        author,
        isbn,
        category,
        published_date,
        total_copies,
        borrowed_copies,
        location,
        description,
        cover,
    } = req.body;

    if (!title || !title.trim() || !author || !author.trim()) {
        return res.status(400).json({
            error: "Book title and author are required"
        });
    }

    const sql = `
        INSERT INTO books
        (title, author, isbn, category, published_date,
         total_copies, borrowed_copies, location, description, cover)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
        title.trim(),
        author.trim(),
        isbn || "",
        category || "Literature",
        published_date || null,
        Number(total_copies) || 1,
        Number(borrowed_copies) || 0,
        location || "",
        description || "",
        cover && cover.trim() ? cover.trim():null
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error adding book:", err.message);
            return res.status(500).json({
                error: "Failed to add book"
            });
        }

        res.status(201).json({
            message: "Book added successfully",
            id: result.insertId
        });
    });
});

// PUT: Update an existing book
app.put("/api/books/:id", (req, res) => {
    const {
        title,
        author,
        isbn,
        category,
        published_date,
        total_copies,
        borrowed_copies,
        location,
        description,
        cover
    } = req.body;

    if (!title || !title.trim() || !author || !author.trim()) { 
        return res.status(400).json({
            error: "Book title and author are required"
        });
    }

    const sql = `
        UPDATE books
        SET title = ?, author = ?, isbn = ?, category = ?,
            published_date = ?, total_copies = ?,
            borrowed_copies = ?, location = ?,
            description = ?, cover = ?
        WHERE id = ?`;

    const values = [
        title.trim(),
        author.trim(),
        isbn || "",
        category || "Literature",
        published_date || null,
        Number(total_copies) || 1,
        Number(borrowed_copies) || 0,
        location || "",
        description || "",
        cover || "images/alemenor.jpg",
        req.params.id
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error updating book:", err.message);
            return res.status(500).json({
                error: "Failed to update book"
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Book not found or no changes were made"
            });
        }

        res.json({
            message: "Book updated successfully"
        });
    });
});

// DELETE: Delete a book
app.delete("/api/books/:id", (req, res) => {
    const sql = "DELETE FROM books WHERE id = ?";

    db.query(sql, [req.params.id], (err, result) => {
        if (err) {
            console.error("Error deleting book:", err.message);
            return res.status(500).json({
                error: "Failed to delete book"
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Book not found"
            });
        }

        res.json({
            message: "Book deleted successfully"
        });
    });
});

// Handle unknown API routes
app.use("/api", (req, res) => {
    res.status(404).json({
        error: "API route not found"
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});