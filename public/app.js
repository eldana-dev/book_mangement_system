"use strict";

// ============================================
// LIBRARYHUB - BOOK MANAGEMENT SYSTEM
// Connected to Node.js, Express and MySQL
// ============================================

const API_URL = "/api/books";

// 1. GET HTML ELEMENTS
const bookGrid = document.getElementById("bookGrid");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const statusFilter = document.getElementById("statusFilter");
const sortFilter = document.getElementById("sortFilter");

const addBookBtn = document.getElementById("addBookBtn");
const editBookBtn = document.getElementById("editBookBtn");
const deleteBookBtn = document.getElementById("deleteBookBtn");

const bookModal = document.getElementById("bookModal");
const bookForm = document.getElementById("bookForm");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const emptyState = document.getElementById("emptyState");

let books = [];
let selectedBookId = null;
let editingBookId = null;
let isSaving = false;

// 2. STARTER BOOKS
// Inserted into MySQL only if the database has no books.
// The first book intentionally has no cover image.
const starterBooks = [
    {
        title: "አለመኖር",
        author: "Author name",
        isbn: "",
        category: "Literature",
        published_date: null,
        total_copies: 5,
        borrowed_copies: 0,
        location: "Shelf A1",
        description: "An Ethiopian book in our library collection.",
        cover: ""
    },
    {
        title: "ፍቅር እስከ መቃብር",
        author: "Author name",
        isbn: "",
        category: "Fiction",
        published_date: null,
        total_copies: 3,
        borrowed_copies: 0,
        location: "Shelf A2",
        description: "An Ethiopian book in our library collection.",
        cover: "images/fiker esk meikaber.jpg"
    },
    {
        title: "ግርባብ",
        author: "Author name",
        isbn: "",
        category: "Literature",
        published_date: null,
        total_copies: 4,
        borrowed_copies: 0,
        location: "Shelf A3",
        description: "An Ethiopian book in our library collection.",
        cover: "images/gerbab.jpg"
    }
];

// 3. HELPER FUNCTIONS
function getElement(id) {
    return document.getElementById(id);
}

function getAvailableCopies(book) {
    return Math.max(
        0,
        Number(book.total_copies || 0) -
        Number(book.borrowed_copies || 0)
    );
}

function getBookStatus(book) {
    return getAvailableCopies(book) > 0
        ? "available"
        : "borrowed";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function normalizeBook(book) {
    return {
        ...book,
        id: Number(book.id),
        title: String(book.title ?? ""),
        author: String(book.author ?? ""),
        isbn: String(book.isbn ?? ""),
        category: String(book.category || "Literature"),
        published_date: book.published_date
            ? String(book.published_date).slice(0, 10)
            : "",
        total_copies: Number(book.total_copies ?? 1),
        borrowed_copies: Number(book.borrowed_copies ?? 0),
        location: String(book.location ?? ""),
        description: String(book.description ?? ""),

        // IMPORTANT: Never assign the old cover automatically.
        // Existing saved cover paths are preserved.
        cover: String(book.cover ?? ""),

        createdAt: book.created_at
            ? new Date(book.created_at).getTime()
            : Date.now()
    };
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const responseText = await response.text();
    let data = {};

    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch {
        data = {
            error: responseText || "Unexpected server response."
        };
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            data.message ||
            `Request failed (${response.status})`
        );
    }

    return data;
}

function showMessage(message, isError = false) {
    const messageElement = getElement("formMessage");

    if (messageElement) {
        messageElement.textContent = message;
        messageElement.style.color = isError ? "#dc2626" : "";
    } else if (message) {
        alert(message);
    }
}

function makeCoverPlaceholder(title) {
    const placeholder = document.createElement("div");
    placeholder.className = "cover-placeholder";

    const icon = document.createElement("span");
    icon.textContent = "📚";

    const label = document.createElement("strong");
    label.textContent = title;

    placeholder.append(icon, label);
    return placeholder;
}

// 4. LOAD BOOKS FROM MYSQL
async function loadBooks() {
    if (bookGrid) {
        bookGrid.innerHTML = "<p>Loading books...</p>";
    }

    try {
        let data = await apiRequest(API_URL);

        if (!Array.isArray(data)) {
            throw new Error("The server did not return a book list.");
        }

        // Add starter books only when the table is empty.
        if (data.length === 0) {
            for (const book of starterBooks) {
                await apiRequest(API_URL, {
                    method: "POST",
                    body: JSON.stringify(book)
                });
            }

            data = await apiRequest(API_URL);
        }

        books = data.map(normalizeBook);

        if (!books.some(book => book.id === selectedBookId)) {
            selectedBookId = books.length
                ? books[0].id
                : null;
        }

        displayBooks();
    } catch (error) {
        console.error("Unable to load books:", error);

        if (bookGrid) {
            bookGrid.innerHTML = `
                <p class="error-message">
                    Unable to load books. Check that Node.js and MySQL
                    are running, then refresh the page.
                </p>
            `;
        }

        showMessage(error.message, true);
    }
}

// 5. UPDATE DASHBOARD STATISTICS
function updateStatistics() {
    const totalCopies = books.reduce(
        (sum, book) => sum + book.total_copies,
        0
    );

    const availableCopies = books.reduce(
        (sum, book) => sum + getAvailableCopies(book),
        0
    );

    const borrowedCopies = books.reduce(
        (sum, book) => sum + book.borrowed_copies,
        0
    );

    const totalBooksElement = getElement("totalBooks");
    const availableBooksElement = getElement("availableBooks");
    const borrowedBooksElement = getElement("borrowedBooks");

    if (totalBooksElement) {
        totalBooksElement.textContent = books.length;
    }

    if (availableBooksElement) {
        availableBooksElement.textContent = availableCopies;
    }

    if (borrowedBooksElement) {
        borrowedBooksElement.textContent = borrowedCopies;
    }
}

// 6. DISPLAY, SEARCH, FILTER AND SORT BOOKS
function displayBooks() {
    if (!bookGrid) return;

    const searchTerm = (searchInput?.value || "")
        .trim()
        .toLowerCase();

    const categoryValue = categoryFilter?.value || "";
    const statusValue = statusFilter?.value || "";
    const sortBy = sortFilter?.value || "";

    const selectedCategory =
        categoryValue.toLowerCase() === "all"
            ? ""
            : categoryValue;

    const selectedStatus =
        statusValue.toLowerCase() === "all"
            ? ""
            : statusValue;

    let filteredBooks = books.filter(book => {
        const matchesSearch = [
            book.title,
            book.author,
            book.isbn,
            book.category,
            book.tag || ""
        ].some(value =>
            String(value).toLowerCase().includes(searchTerm)
        );

        const matchesCategory =
            !selectedCategory ||
            book.category.toLowerCase() ===
                selectedCategory.toLowerCase();

        const matchesStatus =
            !selectedStatus ||
            getBookStatus(book) === selectedStatus.toLowerCase();

        return matchesSearch && matchesCategory && matchesStatus;
    });

    filteredBooks.sort((a, b) => {
        if (sortBy === "author") {
            return a.author.localeCompare(b.author);
        }

        if (sortBy === "newest") {
            return b.createdAt - a.createdAt;
        }

        if (sortBy === "oldest") {
            return a.createdAt - b.createdAt;
        }

        if (sortBy === "available") {
            return getAvailableCopies(b) - getAvailableCopies(a);
        }

        return a.title.localeCompare(b.title);
    });

    bookGrid.innerHTML = "";

    filteredBooks.forEach(book => {
        const status = getBookStatus(book);
        const available = getAvailableCopies(book);

        const card = document.createElement("article");

        card.className =
            "book-card" +
            (book.id === selectedBookId ? " selected" : "");

        card.dataset.bookId = book.id;
        card.tabIndex = 0;

        // Build the cover area without using an old default image.
        const coverContainer = document.createElement("div");
        coverContainer.className = "book-cover";

        if (book.cover.trim()) {
            const image = document.createElement("img");
            image.src = book.cover;
            image.alt = `Cover of ${book.title}`;

            const placeholder = makeCoverPlaceholder(book.title);
            placeholder.style.display = "none";

            image.addEventListener("error", () => {
                image.style.display = "none";
                placeholder.style.display = "flex";
            });

            image.addEventListener("load", () => {
                image.style.display = "block";
                placeholder.style.display = "none";
            });

            coverContainer.append(image, placeholder);
        } else {
            coverContainer.append(
                makeCoverPlaceholder(book.title)
            );
        }

        const info = document.createElement("div");
        info.className = "book-card-info";

        info.innerHTML = `
            <h3>${escapeHTML(book.title)}</h3>
            <p class="book-author">${escapeHTML(book.author)}</p>

            <span class="status-badge ${status}">
                ● ${status === "available" ? "Available" : "On Loan"}
            </span>

            <div class="book-card-footer">
                <span>▤ ${available} available</span>
                <button
                    class="more-btn"
                    type="button"
                    aria-label="Select ${escapeHTML(book.title)}"
                >⋯</button>
            </div>
        `;

        card.append(coverContainer, info);

        card.addEventListener("click", () => {
            selectBook(book.id);
        });

        card.addEventListener("keydown", event => {
            if (
                event.target === card &&
                (event.key === "Enter" || event.key === " ")
            ) {
                event.preventDefault();
                selectBook(book.id);
            }
        });

        card.querySelector(".more-btn").addEventListener(
            "click",
            event => {
                event.stopPropagation();
                selectBook(book.id);
            }
        );

        bookGrid.appendChild(card);
    });

    if (emptyState) {
        emptyState.hidden = filteredBooks.length > 0;
    }

    updateStatistics();
    updateSelectedBook();
}

// 7. SELECT A BOOK
function selectBook(id) {
    selectedBookId = Number(id);
    displayBooks();
}

// 8. DISPLAY SELECTED BOOK DETAILS
function updateSelectedBook() {
    const details = getElement("bookDetails");
    const book = books.find(item => item.id === selectedBookId);

    if (!book) {
        if (details) details.hidden = true;
        if (editBookBtn) editBookBtn.disabled = true;
        if (deleteBookBtn) deleteBookBtn.disabled = true;
        return;
    }

    if (details) details.hidden = false;

    const setText = (id, value) => {
        const element = getElement(id);
        if (element) element.textContent = value;
    };

    setText("detailTitle", book.title);
    setText("detailAuthor", book.author);
    setText("detailAuthorInfo", book.author);
    setText("detailISBN", book.isbn || "Not provided");
    setText("detailCategory", book.category);
    setText("detailPublished", book.published_date || "Not provided");
    setText("detailTotalCopies", book.total_copies);
    setText("detailAvailableCopies", getAvailableCopies(book));
    setText("detailLocation", book.location || "Not provided");
    setText(
        "detailDescription",
        book.description || "No description provided."
    );

    const statusElement = getElement("detailStatus");

    if (statusElement) {
        const status = getBookStatus(book);
        statusElement.className = `status-badge ${status}`;
        statusElement.textContent =
            status === "available" ? "● Available" : "● On Loan";
    }

    const detailCover = getElement("detailCover");

    if (detailCover) {
        const detailPlaceholder = detailCover.nextElementSibling;

        if (book.cover.trim()) {
            detailCover.style.display = "block";
            detailCover.src = book.cover;
            detailCover.alt = `Cover of ${book.title}`;

            detailCover.onerror = () => {
                detailCover.style.display = "none";

                if (detailPlaceholder) {
                    detailPlaceholder.style.display = "flex";
                    const label = detailPlaceholder.querySelector("strong");
                    if (label) label.textContent = book.title;
                }
            };

            detailCover.onload = () => {
                detailCover.style.display = "block";

                if (detailPlaceholder) {
                    detailPlaceholder.style.display = "none";
                }
            };
        } else {
            // No cover saved: show a placeholder instead.
            detailCover.removeAttribute("src");
            detailCover.style.display = "none";

            if (detailPlaceholder) {
                detailPlaceholder.style.display = "flex";
                const label = detailPlaceholder.querySelector("strong");
                if (label) label.textContent = book.title;
            }
        }
    }

    if (editBookBtn) editBookBtn.disabled = false;
    if (deleteBookBtn) deleteBookBtn.disabled = false;
}

// 9. OPEN ADD BOOK FORM
function openAddModal() {
    editingBookId = null;

    bookForm.reset();

    getElement("bookId").value = "";
    getElement("modalTitle").textContent = "Add New Book";
    getElement("saveBookBtn").textContent = "Save Book";
    getElement("bookCopies").value = 1;

    // Explicitly clear the cover field, even if HTML has a default value.
    const coverInput = getElement("bookCover");
    if (coverInput) coverInput.value = "";

    showMessage("");

    bookModal.hidden = false;
    getElement("bookTitle").focus();
}

// 10. OPEN EDIT BOOK FORM
function openEditModal() {
    const book = books.find(item => item.id === selectedBookId);
    if (!book) return;

    editingBookId = book.id;

    getElement("bookId").value = book.id;
    getElement("bookTitle").value = book.title;
    getElement("bookAuthor").value = book.author;
    getElement("bookISBN").value = book.isbn;
    getElement("bookCategory").value = book.category;
    getElement("bookPublished").value = book.published_date;
    getElement("bookCopies").value = book.total_copies;
    getElement("bookLocation").value = book.location;
    getElement("bookDescription").value = book.description;
    getElement("bookCover").value = book.cover;

    getElement("modalTitle").textContent = "Edit Book";
    getElement("saveBookBtn").textContent = "Update Book";

    showMessage("");

    bookModal.hidden = false;
}

// 11. ADD OR UPDATE A BOOK IN MYSQL
bookForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (isSaving) return;

    const title = getElement("bookTitle").value.trim();
    const author = getElement("bookAuthor").value.trim();
    const totalCopies = Number(getElement("bookCopies").value);

    if (!title || !author) {
        showMessage("Please enter the book title and author.", true);
        return;
    }

    if (!Number.isInteger(totalCopies) || totalCopies < 1) {
        showMessage(
            "Total copies must be a whole number greater than zero.",
            true
        );
        return;
    }

    const existingBook = books.find(
        book => book.id === editingBookId
    );

    if (
        existingBook &&
        totalCopies < existingBook.borrowed_copies
    ) {
        showMessage(
            "Total copies cannot be less than borrowed copies.",
            true
        );
        return;
    }

    const bookData = {
        title,
        author,
        isbn: getElement("bookISBN").value.trim(),
        category: getElement("bookCategory").value || "Literature",
        published_date: getElement("bookPublished").value || null,
        total_copies: totalCopies,
        borrowed_copies: existingBook
            ? existingBook.borrowed_copies
            : 0,
        location: getElement("bookLocation").value.trim(),
        description: getElement("bookDescription").value.trim(),

        // Blank cover means no cover. Never assign the old image.
        cover: getElement("bookCover").value.trim()
    };

    const saveButton = getElement("saveBookBtn");
    const wasEditing = editingBookId !== null;

    isSaving = true;

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
    }

    try {
        if (wasEditing) {
            const id = editingBookId;

            await apiRequest(`${API_URL}/${id}`, {
                method: "PUT",
                body: JSON.stringify(bookData)
            });

            selectedBookId = id;
        } else {
            const result = await apiRequest(API_URL, {
                method: "POST",
                body: JSON.stringify(bookData)
            });

            selectedBookId = result.id
                ? Number(result.id)
                : null;
        }

        bookModal.hidden = true;

        await loadBooks();

        showMessage(
            wasEditing
                ? "Book updated successfully!"
                : "Book added successfully!"
        );
    } catch (error) {
        console.error("Unable to save book:", error);
        showMessage(error.message || "Unable to save the book.", true);
    } finally {
        isSaving = false;

        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = wasEditing
                ? "Update Book"
                : "Save Book";
        }
    }
});

// 12. DELETE BOOK FROM MYSQL
if (deleteBookBtn) {
    deleteBookBtn.addEventListener("click", async () => {
        const book = books.find(
            item => item.id === selectedBookId
        );

        if (!book) return;

        if (book.borrowed_copies > 0) {
            alert("Return all borrowed copies before deleting this book.");
            return;
        }

        const confirmed = confirm(
            `Are you sure you want to delete "${book.title}"?`
        );

        if (!confirmed) return;

        try {
            await apiRequest(`${API_URL}/${book.id}`, {
                method: "DELETE"
            });

            selectedBookId = null;

            await loadBooks();

            alert("Book deleted successfully.");
        } catch (error) {
            console.error("Unable to delete book:", error);
            alert(error.message || "Unable to delete the book.");
        }
    });
}

// 13. CLOSE THE FORM
function closeModal() {
    if (bookModal) bookModal.hidden = true;
}

if (addBookBtn) {
    addBookBtn.addEventListener("click", openAddModal);
}

if (editBookBtn) {
    editBookBtn.addEventListener("click", openEditModal);
}

if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeModal);
}

if (cancelModalBtn) {
    cancelModalBtn.addEventListener("click", closeModal);
}

if (bookModal) {
    bookModal.addEventListener("click", event => {
        if (event.target === bookModal) {
            closeModal();
        }
    });
}

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && bookModal && !bookModal.hidden) {
        closeModal();
    }
});

// 14. SEARCH, FILTER AND SORT
if (searchInput) {
    searchInput.addEventListener("input", displayBooks);
}

if (categoryFilter) {
    categoryFilter.addEventListener("change", displayBooks);
}

if (statusFilter) {
    statusFilter.addEventListener("change", displayBooks);
}

if (sortFilter) {
    sortFilter.addEventListener("change", displayBooks);
}

// 15. START APPLICATION
loadBooks();