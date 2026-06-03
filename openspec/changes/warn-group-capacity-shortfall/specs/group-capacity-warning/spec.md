## ADDED Requirements

### Requirement: Group capacity shortfalls are calculated from staffing rules and linked active staff

The system SHALL calculate a group's weekly staffing demand from every configured staffing rule's duration multiplied by `minStaff`, and SHALL calculate weekly available capacity from linked active staff members' `maxHoursPerWeek`.

#### Scenario: Staffing rules define weekly demand

- **WHEN** a group has staffing rules requiring 3 staff from `06:00` to `17:00` on Monday through Friday
- **THEN** the calculated weekly staffing demand is 165 hours

#### Scenario: Linked active staff define available capacity

- **WHEN** a group has 3 linked active staff members and each linked active staff member has `maxHoursPerWeek` of 37
- **THEN** the calculated weekly available capacity is 111 hours

#### Scenario: Inactive linked staff are excluded from capacity

- **WHEN** a group has one linked active staff member with `maxHoursPerWeek` of 37 and one linked inactive staff member with `maxHoursPerWeek` of 37
- **THEN** the calculated weekly available capacity is 37 hours

#### Scenario: Unlinked active staff are excluded from capacity

- **WHEN** a group has one linked active staff member with `maxHoursPerWeek` of 37 and one unlinked active staff member with `maxHoursPerWeek` of 37
- **THEN** the calculated weekly available capacity is 37 hours

### Requirement: Group detail page warns when linked active capacity is insufficient

The system SHALL show a visible warning on a specific group detail page when calculated weekly available capacity is lower than calculated weekly staffing demand.

#### Scenario: Group has insufficient linked staff capacity

- **WHEN** a group detail page is viewed for a group with 165 weekly demand hours and 111 linked active capacity hours
- **THEN** the page shows a warning that the group is short 54 hours this week based on current staffing rules and linked staff capacity

#### Scenario: Group has exactly enough linked staff capacity

- **WHEN** a group detail page is viewed for a group with 111 weekly demand hours and 111 linked active capacity hours
- **THEN** the page does not show a staffing-capacity shortfall warning

#### Scenario: Group has more than enough linked staff capacity

- **WHEN** a group detail page is viewed for a group with 100 weekly demand hours and 111 linked active capacity hours
- **THEN** the page does not show a staffing-capacity shortfall warning

#### Scenario: Group has no staffing rules

- **WHEN** a group detail page is viewed for a group with no configured staffing rules
- **THEN** the page does not show a staffing-capacity shortfall warning

#### Scenario: Warning message includes missing weekly hours

- **WHEN** a group detail page is viewed for a group where weekly staffing demand exceeds linked active capacity by 54 hours
- **THEN** the warning message includes `54 hours`
