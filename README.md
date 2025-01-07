# StreamFlow

A modern, real-time file upload component built with Next.js, shadcn/ui, and TailwindCSS.

## Features

- 📤 Chunked file uploads
- 🔄 Real-time progress tracking
- 📱 Responsive design
- 🎨 Customizable theming
- ♿ Accessible components
- 📁 Multi-file support
- 🖼️ File preview support
- 🚀 WebSocket integration
- 🔍 File validation
- 🔄 Automatic retry logic

## Installation

```bash
npm install @your-org/streamflow
# or
yarn add @your-org/streamflow
# or
pnpm add @your-org/streamflow
```

## Requirements

- Next.js 13+
- React 18+
- TailwindCSS 3+
- shadcn/ui 2.1.8+

## Usage

```tsx
import { StreamFlow } from '@your-org/streamflow'

export default function YourComponent() {
  return (
    <StreamFlow
      endpoint="/api/upload"
      websocketUrl="ws://your-websocket-url"
      maxFileSize={10 * 1024 * 1024} // 10MB
      chunkSize={1 * 1024 * 1024} // 1MB
      allowedFileTypes={['image/*', 'application/pdf']}
      onUploadComplete={(files) => {
        console.log('Upload complete:', files)
      }}
    />
  )
}
```

## Configuration Options

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| endpoint | string | - | Upload endpoint URL |
| websocketUrl | string | - | WebSocket server URL |
| maxFileSize | number | 10485760 | Maximum file size in bytes |
| chunkSize | number | 1048576 | Chunk size in bytes |
| allowedFileTypes | string[] | [] | Array of allowed MIME types |
| multiple | boolean | true | Allow multiple file selection |
| onUploadStart | (files: File[]) => void | - | Callback when upload starts |
| onUploadProgress | (progress: number) => void | - | Callback for upload progress |
| onUploadComplete | (files: File[]) => void | - | Callback when upload completes |
| onError | (error: Error) => void | - | Callback when error occurs |

## Styling

StreamFlow uses TailwindCSS and shadcn/ui for styling. You can customize the appearance by:

1. Modifying TailwindCSS classes
2. Using shadcn/ui theming
3. Overriding CSS variables

```css
:root {
  --streamflow-primary: 222.2 47.4% 11.2%;
  --streamflow-secondary: 210 40% 96.1%;
  --streamflow-border: 214.3 31.8% 91.4%;
}
```

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build package
pnpm build

# Run tests
pnpm test
```

## License

MIT © [Your Organization]
