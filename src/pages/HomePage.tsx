import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      <h1 className="text-4xl font-bold mb-4 text-center">
        VNS Health Provider Services Portal – POC
      </h1>
      <p className="text-lg text-gray-600 mb-8 text-center">
        Patient + Caregiver • Phase 1: Documents
      </p>
      <div className="flex gap-4">
        <Link
          to="/documents"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Documents
        </Link>
        <Link
          to="/login"
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Login
        </Link>
      </div>
    </div>
  );
}

export default HomePage;
