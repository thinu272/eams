// backend/services/azureStorage/azureBlobService.js
// Azure Blob Storage helper service
// Provides upload and delete functions using @azure/storage-blob
// Environment variables required:
//   AZURE_STORAGE_CONNECTION_STRING - full connection string
//   AZURE_STORAGE_CONTAINER - default container name

const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Validate required env vars at load time
const rawConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const connectionString = rawConnectionString && !rawConnectionString.startsWith('Your_Azure') ? rawConnectionString : undefined;
const rawContainerName = process.env.AZURE_STORAGE_CONTAINER;
const containerName = rawContainerName && !rawContainerName.includes('your-container-name') ? rawContainerName : undefined;
let isAzureConfigured = true;
if (!connectionString) {
  console.warn('AZURE_STORAGE_CONNECTION_STRING not set or placeholder – Azure Blob Service disabled.');
  isAzureConfigured = false;
}
if (!containerName) {
  console.warn('AZURE_STORAGE_CONTAINER not set or placeholder – Azure Blob Service disabled.');
  isAzureConfigured = false;
}
// If Azure is not configured we will fall back to local storage; no throw here.

let blobServiceClient = null;
let containerClient = null;

if (isAzureConfigured) {
  blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
}

async function getContainerClient() {
  if (!isAzureConfigured) return null;
  if (containerClient) return containerClient;
  containerClient = blobServiceClient.getContainerClient(containerName);
  const exists = await containerClient.exists();
  if (!exists) {
    await containerClient.create();
  }
  return containerClient;
}

/**
 * Upload a buffer to Azure Blob Storage.
 * @param {Buffer} buffer - File data buffer.
 * @param {string} originalName - Original file name (for extension detection).
 * @param {string} mimeType - MIME type of the file.
 * @returns {Promise<string>} - URL of uploaded blob.
 */
async function uploadBuffer(buffer, originalName, mimeType) {
  if (!buffer || !originalName) {
    throw new Error('Invalid buffer or originalName for upload');
  }
  const ext = path.extname(originalName).toLowerCase();
  const uniqueName = `${uuidv4()}${ext}`;

  if (!isAzureConfigured) {
    // Fallback: store locally in the uploads folder
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const localPath = path.join(uploadDir, uniqueName);
    fs.writeFileSync(localPath, buffer);
    // Return a pseudo‑URL that the frontend can still use (served statically by Express)
    return `${process.env.BACKEND_URL || 'http://localhost:5000'}/uploads/${uniqueName}`;
  }

  const client = await getContainerClient();
  const blockBlobClient = client.getBlockBlobClient(uniqueName);
  const uploadOptions = {
    blobHTTPHeaders: {
      blobContentType: mimeType || 'application/octet-stream',
    },
  };
  await blockBlobClient.uploadData(buffer, uploadOptions);
  return blockBlobClient.url;
}

/**
 * Delete a blob by its full URL.
 * @param {string} blobUrl - Full URL of the blob to delete.
 */
async function deleteBlobByUrl(blobUrl) {
  if (!blobUrl) return;
  if (!isAzureConfigured) {
    // Local fallback: attempt to delete the file from the uploads folder
    try {
      const filename = path.basename(blobUrl);
      const localPath = path.join(__dirname, '../../uploads', filename);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    } catch (err) {
      console.error('Local deleteBlobByUrl error:', err.message);
    }
    return;
  }
  try {
    const url = new URL(blobUrl);
    const blobName = url.pathname.split('/').pop();
    const client = await getContainerClient();
    const blockBlobClient = client.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
  } catch (err) {
    console.error('Azure deleteBlobByUrl error:', err.message);
  }
}

module.exports = {
  uploadBuffer,
  deleteBlobByUrl,
};
