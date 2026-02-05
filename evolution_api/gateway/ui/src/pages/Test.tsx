import { useState } from 'react'
import { waApi } from '../api'

export default function TestPage() {
  const [recipient, setRecipient] = useState('')
  const [message, setMessage] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaType, setMediaType] = useState<'image' | 'document' | 'audio' | 'video'>('image')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipient || !message) {
      setResult({ success: false, message: 'Recipient and message are required' })
      return
    }

    setSending(true)
    setResult(null)

    try {
      const response = await waApi.sendTestMessage(recipient, message)
      setResult({
        success: true,
        message: `✅ Message sent successfully! ID: ${response.message_id || 'N/A'}`,
      })
      setMessage('')
    } catch (error: any) {
      setResult({
        success: false,
        message: `❌ Failed to send: ${error.message}`,
      })
    } finally {
      setSending(false)
    }
  }

  const handleSendMedia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipient || !mediaUrl) {
      setResult({ success: false, message: 'Recipient and media URL are required' })
      return
    }

    setSending(true)
    setResult(null)

    try {
      const response = await waApi.sendTestMedia(recipient, mediaUrl, mediaType)
      setResult({
        success: true,
        message: `✅ Media sent successfully! ID: ${response.message_id || 'N/A'}`,
      })
      setMediaUrl('')
    } catch (error: any) {
      setResult({
        success: false,
        message: `❌ Failed to send media: ${error.message}`,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Test Messages</h2>
      </div>

      <p className="text-gray-600">
        Send test messages to verify your WhatsApp connection is working properly.
      </p>

      {result && (
        <div
          className={`p-4 rounded-md ${
            result.success
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {result.message}
        </div>
      )}

      {/* Recipient Input */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">📱 Recipient</h3>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Phone Number or Chat ID
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="e.g., 1234567890 or 1234567890@s.whatsapp.net"
            className="input"
          />
          <p className="text-sm text-gray-500">
            Enter a phone number (without + or spaces) or a full WhatsApp ID.
            For groups, use the group ID ending in @g.us
          </p>
        </div>
      </div>

      {/* Text Message Form */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">💬 Send Text Message</h3>
        <form onSubmit={handleSendText} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Type your message here..."
              className="input"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !recipient || !message}
            className="btn btn-primary"
          >
            {sending ? '📤 Sending...' : '📤 Send Text Message'}
          </button>
        </form>
      </div>

      {/* Media Message Form */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">📎 Send Media</h3>
        <form onSubmit={handleSendMedia} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Media Type
            </label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as any)}
              className="input max-w-[200px]"
            >
              <option value="image">🖼️ Image</option>
              <option value="document">📄 Document</option>
              <option value="audio">🎵 Audio</option>
              <option value="video">🎬 Video</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Media URL
            </label>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="input"
            />
            <p className="text-sm text-gray-500 mt-1">
              Enter a publicly accessible URL to the media file.
            </p>
          </div>
          <button
            type="submit"
            disabled={sending || !recipient || !mediaUrl}
            className="btn btn-primary"
          >
            {sending ? '📤 Sending...' : '📤 Send Media'}
          </button>
        </form>
      </div>

      {/* Help Section */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="text-lg font-medium text-blue-900 mb-2">💡 Tips</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Phone numbers should include country code (e.g., 31612345678 for Netherlands)</li>
          <li>Do not include + or spaces in phone numbers</li>
          <li>For groups, find the Group ID in the Chats tab after syncing</li>
          <li>Media URLs must be publicly accessible (not behind authentication)</li>
          <li>Supported image formats: JPG, PNG, GIF, WebP</li>
          <li>Supported document formats: PDF, DOC, DOCX, XLS, XLSX, etc.</li>
        </ul>
      </div>
    </div>
  )
}
