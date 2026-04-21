public class TicketTest {

    public static String getTicketType(String timeStr) {
        String[] parts = timeStr.split(":");
        int hour = Integer.parseInt(parts[0]);
        int minute = Integer.parseInt(parts[1]);
        int totalMinutes = hour * 60 + minute;

        if (totalMinutes < 9 * 60 + 30) {
            return "regular"; // vé thường
        } else if (totalMinutes < 16 * 60) {
            return "discount"; // vé tiết kiệm
        } else if (totalMinutes < 19 * 60 + 30) {
            return "regular"; // vé thường
        } else {
            return "discount"; // vé tiết kiệm
        }
    }

    public static void main(String[] args) {
        String[][] testCases = {
            {"08:00", "regular"},
            {"09:29", "regular"},
            {"09:30", "discount"},
            {"09:31", "discount"},
            {"12:00", "discount"},
            {"15:59", "discount"},
            {"16:00", "regular"},
            {"16:01", "regular"},
            {"18:00", "regular"},
            {"19:29", "regular"},
            {"19:30", "discount"},
            {"19:31", "discount"},
            {"22:00", "discount"},
            {"23:59", "discount"}
        };

        for (String[] testCase : testCases) {
            String input = testCase[0];
            String expected = testCase[1];
            String result = getTicketType(input);

            if (result.equals(expected)) {
                System.out.println("[PASS] " + input + " -> " + result);
            } else {
                System.out.println("[FAIL] " + input + " -> " + result + " (expected: " + expected + ")");
            }
        }

        System.out.println("\nDone testing!");
    }
}
