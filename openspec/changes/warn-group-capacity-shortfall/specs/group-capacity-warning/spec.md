## ADDED Requirements

### Requirement: Group total capacity shortfalls are calculated from staffing rules and linked active staff

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

### Requirement: Group pedagog capacity shortfalls are calculated from staffing rules and linked active pedagog staff

The system SHALL calculate a group's weekly pedagog staffing demand from every configured staffing rule's duration multiplied by `minPedagogs`, and SHALL calculate weekly available pedagog capacity from linked active pedagog staff members' `maxHoursPerWeek`.

#### Scenario: Staffing rules define weekly pedagog demand

- **WHEN** a group has staffing rules requiring 1 pedagog from `06:00` to `17:00` on Monday through Friday
- **THEN** the calculated weekly pedagog staffing demand is 55 hours

#### Scenario: Linked active pedagog staff define available pedagog capacity

- **WHEN** a group has 1 linked active pedagog staff member with `maxHoursPerWeek` of 37 and 1 linked active non-pedagog staff member with `maxHoursPerWeek` of 37
- **THEN** the calculated weekly available pedagog capacity is 37 hours

#### Scenario: Inactive linked pedagog staff are excluded from pedagog capacity

- **WHEN** a group has one linked active pedagog staff member with `maxHoursPerWeek` of 37 and one linked inactive pedagog staff member with `maxHoursPerWeek` of 37
- **THEN** the calculated weekly available pedagog capacity is 37 hours

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

### Requirement: Group detail page warns when linked active pedagog capacity is insufficient

The system SHALL show a separate visible warning on a specific group detail page when calculated weekly available pedagog capacity is lower than calculated weekly pedagog staffing demand.

#### Scenario: Group has insufficient linked pedagog capacity

- **WHEN** a group detail page is viewed for a group with 55 weekly pedagog demand hours and 37 linked active pedagog capacity hours
- **THEN** the page shows a warning that the group is short 18 pedagog hours this week based on current staffing rules and linked pedagog staff capacity

#### Scenario: Group has exactly enough linked pedagog capacity

- **WHEN** a group detail page is viewed for a group with 37 weekly pedagog demand hours and 37 linked active pedagog capacity hours
- **THEN** the page does not show a pedagog-capacity shortfall warning

#### Scenario: Group has enough total capacity but insufficient pedagog capacity

- **WHEN** a group detail page is viewed for a group with 165 weekly total demand hours, 185 linked active total capacity hours, 55 weekly pedagog demand hours, and 37 linked active pedagog capacity hours
- **THEN** the page shows a pedagog-capacity shortfall warning
- **AND** the page does not show a total staffing-capacity shortfall warning

#### Scenario: Group has both total and pedagog shortfalls

- **WHEN** a group detail page is viewed for a group with 165 weekly total demand hours, 111 linked active total capacity hours, 55 weekly pedagog demand hours, and 37 linked active pedagog capacity hours
- **THEN** the page shows a total staffing-capacity shortfall warning
- **AND** the page shows a separate pedagog-capacity shortfall warning
