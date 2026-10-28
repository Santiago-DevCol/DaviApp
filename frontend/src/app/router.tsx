import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { SearchPage } from '@/features/search/SearchPage';
import { UploadPage } from '@/features/upload/UploadPage';
import { DocumentPage } from '@/features/viewer/DocumentPage';
import { AppShell } from './layout/AppShell';
import { NotFoundPage } from './NotFoundPage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/search" replace /> },
      { path: 'upload', element: <UploadPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'documents/:id', element: <DocumentPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
