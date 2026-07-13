export const CACHE_KEYS = {
    // Hospital
    HOSPITAL: "hospital",

    // Departments
    DEPARTMENTS: "departments",
    DEPARTMENT: (id) => `department:${id}`,

    // Doctors
    DOCTORS: "doctors",
    DOCTOR: (id) => `doctor:${id}`,

    // Doctor Schedules
    DOCTOR_SCHEDULES: "doctor-schedules",

    // Doctor & Department Relations
    DOCTOR_DEPARTMENT: (id) => `doctor-department:${id}`,
    DOCTOR_DEPARTMENTS: (doctorId) => `doctor:${doctorId}:departments`,
    DEPARTMENT_DOCTORS: (departmentId) => `department:${departmentId}:doctors`,

    // Ads
    ADS: "ads",
    AD: (id) => `ad:${id}`,

    // DASHBOARD
    DASHBOARD: "dashboard-statistics",
    APPOINTMENTS_CHART: "appointments-chart",
};

export const CACHE_TTL = {
    HOSPITAL: 86400, // 24 ساعة
    DEPARTMENTS: 86400, // 24 ساعة
    DOCTORS: 43200, // 12 ساعة
    DOCTOR_DEPARTMENTS: 86400, // 24 ساعة
    DOCTOR_SCHEDULES: 86400, // 24 ساعة
    ADS: 21600, // 6 ساعات
    DASHBOARD = 300
};
