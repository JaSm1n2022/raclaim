import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'
import type { ParsedClaimData } from '../types'

interface FileUploadProps {
  onDataParsed: (data: ParsedClaimData) => void
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void
}

export default function FileUpload({ onDataParsed, isProcessing, setIsProcessing }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      if (file.type === 'application/pdf') {
        setSelectedFile(file)
        toast.success(`File selected: ${file.name}`)
      } else {
        toast.error('Please upload a PDF file')
      }
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  })

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first')
      return
    }

    setIsProcessing(true)
    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await axios.post<ParsedClaimData>('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      onDataParsed(response.data)
      toast.success('PDF processed successfully! Excel file generated.')
    } catch (error: any) {
      console.error('Upload error:', error)
      const errorMsg = error?.response?.data?.details || error?.response?.data?.error || error.message
      toast.error(`Failed to process PDF: ${errorMsg}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto mb-8">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-white'
          }
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center">
          {selectedFile ? (
            <>
              <FileText className="w-16 h-16 text-green-500 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {selectedFile.name}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </>
          ) : (
            <>
              <Upload className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {isDragActive
                  ? 'Drop the PDF file here'
                  : 'Drag & drop your RA Claim PDF here'}
              </p>
              <p className="text-sm text-gray-500">
                or click to browse files
              </p>
            </>
          )}
        </div>
      </div>

      {selectedFile && (
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={() => setSelectedFile(null)}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            disabled={isProcessing}
          >
            Clear
          </button>
          <button
            onClick={handleUpload}
            disabled={isProcessing}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              'Convert to Excel'
            )}
          </button>
        </div>
      )}
    </div>
  )
}
