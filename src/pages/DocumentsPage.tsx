function DocumentsPage() {
  // Mock data for documents table
  const mockDocuments = [
    { type: 'Medical Record', date: '2024-01-15', status: 'Approved', action: 'View' },
    { type: 'Lab Results', date: '2024-01-10', status: 'Pending', action: 'View' },
    { type: 'Prescription', date: '2024-01-05', status: 'Approved', action: 'View' },
  ];

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">Documents</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Your Documents Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Your Documents</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-sm text-gray-700">Type</th>
                  <th className="text-left py-2 px-3 font-semibold text-sm text-gray-700">Date</th>
                  <th className="text-left py-2 px-3 font-semibold text-sm text-gray-700">Status</th>
                  <th className="text-left py-2 px-3 font-semibold text-sm text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {mockDocuments.map((doc, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-3 px-3 text-sm">{doc.type}</td>
                    <td className="py-3 px-3 text-sm text-gray-600">{doc.date}</td>
                    <td className="py-3 px-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        doc.status === 'Approved' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-sm">
                      <button className="text-blue-600 hover:text-blue-800">
                        {doc.action}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upload Document Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Upload Document</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-gray-600 mb-2">Drop files here or click to upload</p>
            <p className="text-sm text-gray-500">(Placeholder - no backend)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentsPage;
