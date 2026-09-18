// backend/services/azureStorage/azureBlobService.js
// Azure Blob Storage helper service
// Provides upload and delete functions using @azure/storage-blob
// Environment variables required:
//   AZURE_STORAGE_CONNECTION_STRING - full connection string
//   AZURE_STORAGE_CONTAINER - default container name

const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Validate required env vars at load time
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER;
if (!connectionString) {
  throw new Error('AZURE_STORAGE_CONNECTION_STRING environment variable is required');
}
if (!containerName) {
  throw new Error('AZURE_STORAGE_CONTAINER environment variable is required');
}

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
let containerClient = null;

async function getContainerClient() {
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
    throw new Error('Invalid buffer or originalName for Azure upload');
  }
  const ext = path.extname(originalName).toLowerCase();
  const uniqueName = `${uuidv4()}${ext}`;
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
