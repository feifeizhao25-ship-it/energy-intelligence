# New Maintenance Tools Implementation

We have successfully integrated a comprehensive suite of AI-driven maintenance tools into the platform, covering the entire operation and maintenance (O&M) lifecycle for renewable energy assets.

## Implemented Features

### 1. Performance Ratio (PR) Depth Analysis
*   **Function**: Calculates and analyzes the Performance Ratio (PR) of solar power stations.
*   **Key Inputs**: Capacity, Actual Generation, Date Range.
*   **AI Logic**: Compares actual vs. theoretical generation (using NASA Power data) and diagnoses anomalies (e.g., soiling vs. degradation).
*   **Access**: "PR Analysis" (PR分析) tab.

### 2. Intelligent Cleaning Decision
*   **Function**: Determines if and when to clean solar panels based on cost-benefit analysis.
*   **Key Inputs**: Last Cleaning Date, Cleaning Cost, Location.
*   **AI Logic**: Estimates soiling loss based on accumulation time and PM2.5 levels vs. the cost of cleaning and downtime.
*   **Access**: "Cleaning Decision" (清洗决策) tab.

### 3. String-Level Fault Localization
*   **Function**: Identifies specific faulty strings within an inverter.
*   **Key Inputs**: Inverter ID, String Data (Voltage, Current).
*   **AI Logic**: Detects outliers in voltage/current patterns to pinpoint underperforming strings (e.g., blown fuse, shading).
*   **Access**: "String Analysis" (组串分析) tab.

### 4. IV Curve Analysis
*   **Function**: Diagnoses component health using IV curve parameters.
*   **Key Inputs**: Voc, Isc, Vmp, Imp, Pmax (Measured).
*   **AI Logic**: Analyzes curve morphology and parameter deviations to identify specific issues like PID, micro-cracks, or bypass diode failure.
*   **Access**: "IV Scan" (IV扫描) tab.

### 5. Automated Work Permit Generation
*   **Function**: Generates standardized work permits for specific maintenance tasks.
*   **Key Inputs**: Task Type (Cleaning, Inspection, etc.), Location, Time, Staff.
*   **AI Logic**: Auto-populates safety measures, risk controls, and standard operating procedures (SOPs) based on the task type.
*   **Access**: "Work Permit" (工作票) tab.

### 6. Predictive Maintenance Planning
*   **Function**: Forecasts component lifespans and estimates annual maintenance budgets.
*   **Key Inputs**: Commission Date, Capacity.
*   **AI Logic**: Uses aging models and industry benchmarks to predict when components (inverters, fans) will need replacement or service.
*   **Access**: "Predictive Maintenance" (预测维护) tab.

## Technical Architecture

*   **Backend**: Expanded `src/lib/ai/tool-executor.ts` to route requests to specialized maintenance modules (`src/lib/maintenance/*.ts`).
*   **API**: Updated `/api/maintenance` to handle new action types.
*   **Frontend**: Enhanced `src/app/(dashboard)/maintenance/page.tsx` with a multi-tab interface, managing state for 8 distinct maintenance tools.

## usage

1.  Navigate to the **Maintenance** page.
2.  Select the desired tool tab from the top navigation bar.
3.  Fill in the form with the relevant station or device data.
4.  Click the action button (e.g., "Analyze", "Generate") to receive the AI-driven report.
