# PDF Export Feature - MongoDB Storage

## Overview
Conversations can now be exported as PDFs and stored directly in MongoDB. This eliminates the need for file system storage and keeps all data centralized.

## How It Works

### 1. PDF Storage in MongoDB
- PDFs are stored as binary data (Buffer) in the Conversation model
- Each conversation can have multiple PDF exports (historical versions)
- PDFs include metadata: fileName, fileSize, createdAt, mimeType

### 2. Database Schema
```javascript
pdfExports: [{
  createdAt: Date,
  fileName: String,
  fileSize: Number,
  data: Buffer,        // Binary PDF data
  mimeType: String     // 'application/pdf'
}]
```

## API Endpoints

### 1. End Conversation and Get PDF (Automatic)
**Endpoint:** `POST /api/conversations/:id/end`

**Description:** Ends a conversation, archives it, generates PDF, saves to MongoDB, and automatically downloads

**Example:**
```bash
curl -X POST http://localhost:3000/api/conversations/conversation123/end \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
- Archives the conversation (status = 'archived')
- Generates and saves PDF to MongoDB
- Automatically downloads the PDF file
- **No further prompting needed - user gets PDF immediately**

**Frontend Usage:**
```javascript
async function endConversation(conversationId) {
  const response = await fetch(
    `/api/conversations/${conversationId}/end`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  // Automatically trigger PDF download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `conversation-${conversationId}.pdf`;
  a.click();

  // User is NOT prompted - PDF downloads automatically
}
```

---

### 2. Export Conversation to PDF (Manual)
**Endpoint:** `POST /export/:conversationId/pdf`

**Description:** Generates a PDF from conversation history and saves it to MongoDB (legacy endpoint)

**Example:**
```bash
curl -X POST http://localhost:3000/export/conversation123/pdf
```

**Response:** Downloads the PDF file immediately and saves a copy in MongoDB

---

### 2. List All PDFs for a Conversation
**Endpoint:** `GET /export/:conversationId/pdfs`

**Description:** Get a list of all PDF exports for a conversation

**Example:**
```bash
curl http://localhost:3000/export/conversation123/pdfs
```

**Response:**
```json
{
  "conversationId": "conversation123",
  "pdfs": [
    {
      "_id": "pdf123",
      "fileName": "chat-conversation123-1234567890.pdf",
      "fileSize": 45678,
      "createdAt": "2025-11-16T03:30:00.000Z"
    }
  ]
}
```

---

### 3. Download a Specific PDF
**Endpoint:** `GET /export/:conversationId/pdf/:pdfId`

**Description:** Download a previously generated PDF from MongoDB

**Example:**
```bash
curl http://localhost:3000/export/conversation123/pdf/pdf123 --output chat.pdf
```

**Response:** Downloads the PDF file

---

## Benefits

✅ **Centralized Storage** - All data in MongoDB, no file system management
✅ **Version History** - Keep multiple PDF exports for the same conversation
✅ **Backup Friendly** - PDFs backed up with MongoDB backups
✅ **Scalable** - Works across distributed systems
✅ **Portable** - Move data between environments easily

## Considerations

⚠️ **Storage Size** - PDFs can be large; monitor MongoDB storage
⚠️ **Performance** - For very large PDFs, consider GridFS (MongoDB's file storage system)
⚠️ **Memory** - PDFs are loaded into memory when retrieved

## Usage Example (Frontend)

### Recommended: End Conversation with Automatic PDF Download
```javascript
// When user clicks "End Conversation" button
async function endConversation(conversationId) {
  try {
    const response = await fetch(
      `/api/conversations/${conversationId}/end`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to end conversation');
    }

    // Automatically download PDF - no prompting needed
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conversationId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    // Optionally show success message
    console.log('Conversation ended and PDF downloaded successfully');

    // Navigate away or update UI
    window.location.href = '/conversations';
  } catch (error) {
    console.error('Error ending conversation:', error);
  }
}
```

### Alternative: Manual Export
```javascript
// Export conversation to PDF manually
async function exportConversation(conversationId) {
  const response = await fetch(
    `http://localhost:3000/export/${conversationId}/pdf`,
    { method: 'POST' }
  );
  const blob = await response.blob();

  // Download the file
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `conversation-${conversationId}.pdf`;
  a.click();
}

// List all PDFs for a conversation
async function listPDFs(conversationId) {
  const response = await fetch(
    `http://localhost:3000/export/${conversationId}/pdfs`
  );
  const data = await response.json();
  console.log('Available PDFs:', data.pdfs);
}

// Download a specific PDF
async function downloadPDF(conversationId, pdfId) {
  const response = await fetch(
    `http://localhost:3000/export/${conversationId}/pdf/${pdfId}`
  );
  const blob = await response.blob();

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'conversation.pdf';
  a.click();
}
```

## Future Enhancements

1. **GridFS Integration** - For very large PDF files (>16MB)
2. **Compression** - Compress PDFs before storage
3. **Lazy Loading** - Load PDF data only when needed
4. **Expiration** - Auto-delete old PDFs after a certain period
5. **Sharing** - Generate shareable links for PDFs
