# Glass Facade System

A comprehensive field worker attendance and payroll management system designed for secure, location-verified tracking. 

## Key Features

- **Biometric Attendance**: Secure clock-in and clock-out using facial recognition (`face-api.js`).
- **Geo-fencing & Location Tracking**: Captures GPS coordinates during attendance to ensure workers are physically present at the site.
- **Payroll & Overtime (OT)**: Automatically calculates hours worked, processes overtime (hours exceeding 8h/day), and manages salary generation.
- **Automated Notifications**: Integrates with Twilio (WhatsApp) and SMTP (Email) to send out salary slips, OTPs, and password reset links.
- **Admin & Worker Dashboards**: 
  - **Worker**: View monthly attendance history, track present/absent days, and manage face enrollment.
  - **Admin**: Generate 30-day CSV attendance reports, issue bulk salary slips, and manage user accounts.
- **Tech Stack**: Built with React, TypeScript, Tailwind CSS, Express, and MongoDB.
