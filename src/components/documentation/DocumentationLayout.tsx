import React from 'react';

interface DocumentationLayoutProps {
  menu: React.ReactNode;
  content: React.ReactNode;
}

export const DocumentationLayout: React.FC<DocumentationLayoutProps> = ({ menu, content }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 sm:gap-5">
      <div className="lg:sticky lg:top-24 h-fit">{menu}</div>
      <div className="space-y-4 sm:space-y-5">{content}</div>
    </div>
  );
};