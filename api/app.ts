/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import fs from 'fs'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

const corsOptions = {
  origin: '*',
  methods: ['GET', 'HEAD'],
  allowedHeaders: ['Range', 'Content-Type', 'Accept-Encoding'],
  exposedHeaders: ['Content-Range', 'Content-Length', 'Accept-Ranges'],
  maxAge: 86400,
}

app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

const modelsDir = path.join(__dirname, '..', 'public', 'models')

if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true })
}

app.use('/models', (req: Request, res: Response, next: NextFunction) => {
  const filePath = path.join(modelsDir, req.path)
  
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.setHeader('Accept-Ranges', 'bytes')
  
  if (req.headers.range) {
    const stat = fs.statSync(filePath)
    const fileSize = stat.size
    const range = req.headers.range
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    const chunksize = (end - start) + 1
    const file = fs.createReadStream(filePath, { start, end })
    
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'application/octet-stream',
    })
    
    file.pipe(res)
  } else {
    next()
  }
}, express.static(modelsDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.onnx')) {
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
  }
}))

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', error)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  })
})

export default app
