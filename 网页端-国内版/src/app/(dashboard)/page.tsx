      <div className="dashboard-onboarding-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      <div className="dashboard-greeting" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="dashboard-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <div key={p.id} className="dashboard-project-row" onClick={() => router.push(`/projects/${p.id}`)}
            <div className="dashboard-quick-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      )}
      <style jsx global>{`
        @media (max-width: 700px) {
          .dashboard-onboarding-grid,
          .dashboard-kpi-grid,
          .dashboard-main-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .dashboard-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .dashboard-greeting {
            align-items: flex-start !important;
            gap: 12px;
          }
          .dashboard-project-row {
            align-items: flex-start !important;
            gap: 10px;
          }
          .dashboard-quick-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </div>