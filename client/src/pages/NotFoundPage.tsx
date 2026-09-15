import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <h1 className="text-9xl font-extrabold tracking-tight text-gray-200">404</h1>
      <p className="mt-4 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Page not found</p>
      <p className="mt-2 text-base text-gray-500">Sorry, we couldn't find the page you're looking for.</p>
      <div className="mt-8">
        <Link
          to="/"
          className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
        >
          Go back home
        </Link>
      </div>
    </div>
  );
}
