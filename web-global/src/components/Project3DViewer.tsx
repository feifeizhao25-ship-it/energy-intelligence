'use client';

/**
 * Project3DViewer — concept layout preview using CSS transforms. This is not
 * an engineering-grade 3D model; it gives stakeholders a spatial intuition
 * for panel rows, roads and inverter stations.
 */

import React from 'react';

export interface Project3DViewerProps {
  rows?: number;
  columns?: number;
  title?: string;
}

export const Project3DViewer: React.FC<Project3DViewerProps> = ({
  rows = 6,
  columns = 10,
  title = 'Concept layout preview',
}) => (
  <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
    <div
      className="viewer-toolbar"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 12,
        fontSize: 12,
        color: 'var(--text-tertiary)',
      }}
    >
      <span>{title}</span>
      <span>
        {rows} × {columns} array
      </span>
    </div>
    <div
      style={{
        perspective: 800,
        display: 'grid',
        placeItems: 'center',
        padding: '24px 0',
      }}
    >
      <div
        style={{
          transform: 'rotateX(55deg) rotateZ(-35deg)',
          transformStyle: 'preserve-3d',
          display: 'grid',
          gridTemplateRows: `repeat(${rows}, 18px)`,
          gridTemplateColumns: `repeat(${columns}, 28px)`,
          gap: 6,
        }}
      >
        {Array.from({ length: rows * columns }).map((_, index) => (
          <div
            key={index}
            style={{
              background: 'linear-gradient(135deg, #1f56d1, #2f6bed)',
              borderRadius: 2,
              boxShadow: '4px 4px 0 rgba(23,35,59,0.25)',
              height: 18,
              width: 28,
            }}
          />
        ))}
      </div>
    </div>
  </div>
);

export default Project3DViewer;
