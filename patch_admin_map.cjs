const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// First, add the import
code = code.replace(
  `import { MonthlyAttendanceTable } from '../components/MonthlyAttendanceTable';`,
  `import { MonthlyAttendanceTable } from '../components/MonthlyAttendanceTable';\nimport { MapTab } from '../components/MapTab';`
);

// Second, add the Map Tab under the main grid
const mapCode = `
          {/* Map View */}
          <div className="mt-6">
            <Card className="flex flex-col shadow-sm border-card-border overflow-hidden">
              <CardHeader className="pb-3 border-b border-card-border/50 bg-card-bg">
                <CardTitle>Map View: Geofences & Worker Check-ins</CardTitle>
              </CardHeader>
              <div className="p-0">
                <MapTab sites={sites} attendance={attendance} users={users} />
              </div>
            </Card>
          </div>
`;

code = code.replace(
  `            </div>\n          </div>\n        </div>\n      </div>\n\n      {/* Attendance Edit Modal */}`,
  `            </div>\n          </div>\n${mapCode}\n        </div>\n      </div>\n\n      {/* Attendance Edit Modal */}`
);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
