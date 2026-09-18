import { test, expect } from "@playwright/test";

test("User Management API CRUD", async ({ request }) => {
  const unique = Date.now();

  // 1. Login as Plant Head / Admin
  const loginResponse = await request.post(
    "http://127.0.0.1:8000/api/auth/login",
    {
      data: {
        email: "admin@axis.local",
        password: "Admin@123",
      },
    },
  );

  expect(loginResponse.ok()).toBeTruthy();

  const loginBody = await loginResponse.json();
  expect(loginBody.access_token).toBeTruthy();

  const token = loginBody.access_token;

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  // 2. Get roles
  const rolesResponse = await request.get(
    "http://127.0.0.1:8000/api/roles",
    { headers },
  );

  expect(rolesResponse.ok()).toBeTruthy();

  const roles = await rolesResponse.json();
  expect(Array.isArray(roles)).toBeTruthy();
  expect(roles.length).toBeGreaterThanOrEqual(7);

  const roleNames = roles.map((role: any) => role.name);

  expect(roleNames).toContain("Plant Head / Admin");
  expect(roleNames).toContain("Managing Director");
  expect(roleNames).toContain("Sales & Marketing");
  expect(roleNames).toContain("QC / QA");
  expect(roleNames).toContain("PPIC Planner");
  expect(roleNames).toContain("Production / Plant");
  expect(roleNames).toContain("Stores & Supply Chain");

  // 3. Get users
  const usersResponse = await request.get(
    "http://127.0.0.1:8000/api/admin/users",
    { headers },
  );

  expect(usersResponse.ok()).toBeTruthy();

  const users = await usersResponse.json();
  expect(Array.isArray(users)).toBeTruthy();

  // 4. Create a new user
  const email = `automation.user.${unique}@example.com`;

  const createResponse = await request.post(
    "http://127.0.0.1:8000/api/admin/users",
    {
      headers,
      data: {
        email,
        password: "Automation@123",
        full_name: `Automation User ${unique}`,
        employee_id: `AUTO-${unique}`,
        department: "Automation Testing",
        phone: "9876543210",
        role_name: "Sales & Marketing",
      },
    },
  );

  expect(createResponse.status()).toBe(200);

  const createdUser = await createResponse.json();

  expect(createdUser.id).toBeTruthy();
  expect(createdUser.email).toBe(email);
  expect(createdUser.full_name).toBe(`Automation User ${unique}`);
  expect(createdUser.employee_id).toBe(`AUTO-${unique}`);
  expect(createdUser.status).toBe("active");
  expect(createdUser.role.name).toBe("Sales & Marketing");

  const userId = createdUser.id;

  // 5. Get created user
  const getResponse = await request.get(
    `http://127.0.0.1:8000/api/admin/users/${userId}`,
    { headers },
  );

  expect(getResponse.ok()).toBeTruthy();

  const fetchedUser = await getResponse.json();

  expect(fetchedUser.id).toBe(userId);
  expect(fetchedUser.email).toBe(email);

  // 6. Update user
  const updateResponse = await request.put(
    `http://127.0.0.1:8000/api/admin/users/${userId}`,
    {
      headers,
      data: {
        full_name: `Updated Automation User ${unique}`,
        department: "Updated Department",
        phone: "9999999999",
        role_name: "PPIC Planner",
      },
    },
  );

  expect(updateResponse.ok()).toBeTruthy();

  const updatedUser = await updateResponse.json();

  expect(updatedUser.id).toBe(userId);
  expect(updatedUser.full_name).toBe(
    `Updated Automation User ${unique}`,
  );
  expect(updatedUser.department).toBe("Updated Department");
  expect(updatedUser.phone).toBe("9999999999");
  expect(updatedUser.role.name).toBe("PPIC Planner");

  // 7. Deactivate user
  const deactivateResponse = await request.patch(
    `http://127.0.0.1:8000/api/admin/users/${userId}/status`,
    {
      headers,
      data: {
        status: "inactive",
      },
    },
  );

  expect(deactivateResponse.ok()).toBeTruthy();

  const inactiveUser = await deactivateResponse.json();

  expect(inactiveUser.id).toBe(userId);
  expect(inactiveUser.status).toBe("inactive");

  // 8. Verify inactive user
  const inactiveGetResponse = await request.get(
    `http://127.0.0.1:8000/api/admin/users/${userId}`,
    { headers },
  );

  expect(inactiveGetResponse.ok()).toBeTruthy();

  const inactiveFetchedUser = await inactiveGetResponse.json();

  expect(inactiveFetchedUser.status).toBe("inactive");

  // 9. Reactivate user
  const activateResponse = await request.patch(
    `http://127.0.0.1:8000/api/admin/users/${userId}/status`,
    {
      headers,
      data: {
        status: "active",
      },
    },
  );

  expect(activateResponse.ok()).toBeTruthy();

  const activeUser = await activateResponse.json();

  expect(activeUser.id).toBe(userId);
  expect(activeUser.status).toBe("active");

  // 10. Delete user
  const deleteResponse = await request.delete(
    `http://127.0.0.1:8000/api/admin/users/${userId}`,
    { headers },
  );

  expect(deleteResponse.ok()).toBeTruthy();

  const deleteBody = await deleteResponse.json();

  expect(deleteBody.user_id).toBe(userId);

  // 11. Verify deletion
  const verifyDeleteResponse = await request.get(
    `http://127.0.0.1:8000/api/admin/users/${userId}`,
    { headers },
  );

  expect(verifyDeleteResponse.status()).toBe(404);
});