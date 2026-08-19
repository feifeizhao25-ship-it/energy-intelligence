      <div className="global-dashboard-greeting" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="global-dashboard-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      <div className="global-dashboard-main" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <div key={p.id} className="global-dashboard-project" onClick={() => router.push('/projects')}
            <div className="global-dashboard-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {isNewUser ? (
      )}
      <style jsx global>{`
        @media (max-width: 700px) {
          .global-dashboard-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .global-dashboard-main {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .global-dashboard-greeting {
            align-items: flex-start !important;
            gap: 12px;
          }
          .global-dashboard-project {
            align-items: flex-start !important;
            gap: 10px;
          }
          .global-dashboard-actions {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </div>
