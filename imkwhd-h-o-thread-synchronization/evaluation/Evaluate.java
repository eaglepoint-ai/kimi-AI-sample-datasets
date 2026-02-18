import java.io.*;
import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

/**
 * Evaluation script for the H2O thread synchronization solution.
 * Runs tests against repository_before and repository_after,
 * compares results, and generates a JSON report.
 */
public class Evaluate {

    static String generateRunId() {
        return UUID.randomUUID().toString();
    }

    static String getJavaVersion() {
        return System.getProperty("java.version");
    }

    static String getPlatform() {
        return System.getProperty("os.name") + "-" +
                System.getProperty("os.version") + "-" +
                System.getProperty("os.arch");
    }

    /**
     * Compiles and runs H2OTest.java against the given repo directory.
     * Returns a map with keys: passed, return_code, output
     */
    static Map<String, Object> runTestsWithRepo(String repoPath, String testsDir, String label) {
        System.out.println("\n" + "=".repeat(60));
        System.out.println("RUNNING TESTS: " + label.toUpperCase());
        System.out.println("=".repeat(60));
        System.out.println("REPO_PATH: " + repoPath);
        System.out.println("Tests directory: " + testsDir);

        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> tests = new LinkedHashMap<>();

        try {
            // Clean previous .class files
            deleteIfExists(Paths.get(repoPath, "H2O.class"));
            deleteIfExists(Paths.get(testsDir, "H2OTest.class"));

            // Compile
            String testFile = Paths.get(testsDir, "H2OTest.java").toString();
            String sourceFile = Paths.get(repoPath, "H2O.java").toString();

            // Check if source exists
            if (!Files.exists(Paths.get(sourceFile))) {
                String msg = "H2O.java not found in " + repoPath;
                System.out.println("[FAIL] " + msg);
                tests.put("passed", false);
                tests.put("return_code", -1);
                tests.put("output", msg);
                result.put("tests", tests);
                result.put("metrics", new LinkedHashMap<>());
                return result;
            }

            ProcessBuilder compilePb = new ProcessBuilder(
                    "javac", "-cp", repoPath, testFile, sourceFile);
            compilePb.redirectErrorStream(true);
            Process compileProc = compilePb.start();
            String compileOutput = readStream(compileProc.getInputStream());
            int compileCode = compileProc.waitFor();

            if (compileCode != 0) {
                String msg = "Compilation failed:\n" + compileOutput;
                System.out.println("[FAIL] " + msg);
                tests.put("passed", false);
                tests.put("return_code", compileCode);
                tests.put("output", truncate(msg, 8000));
                result.put("tests", tests);
                result.put("metrics", new LinkedHashMap<>());
                return result;
            }

            // Run tests
            ProcessBuilder runPb = new ProcessBuilder(
                    "java", "-cp", repoPath + ":" + testsDir, "H2OTest");
            runPb.redirectErrorStream(true);
            Process runProc = runPb.start();

            // Timeout after 120 seconds
            String runOutput;
            boolean finished = runProc.waitFor(120, java.util.concurrent.TimeUnit.SECONDS);
            if (!finished) {
                runProc.destroyForcibly();
                runOutput = readStream(runProc.getInputStream()) + "\n[TIMEOUT after 120s]";
            } else {
                runOutput = readStream(runProc.getInputStream());
            }

            int runCode = finished ? runProc.exitValue() : -1;
            boolean passed = runCode == 0;

            System.out.println(runOutput);
            System.out.println("\nResults: " + (passed ? "PASSED" : "FAILED"));

            tests.put("passed", passed);
            tests.put("return_code", runCode);
            tests.put("output", truncate(runOutput, 8000));
            result.put("tests", tests);
            result.put("metrics", new LinkedHashMap<>());

        } catch (Exception e) {
            String msg = "Error running tests: " + e.getMessage();
            System.out.println("[FAIL] " + msg);
            tests.put("passed", false);
            tests.put("return_code", -1);
            tests.put("output", msg);
            result.put("tests", tests);
            result.put("metrics", new LinkedHashMap<>());
        }

        return result;
    }

    static void runEvaluation() {
        System.out.println("\n" + "=".repeat(60));
        System.out.println("H2O THREAD SYNCHRONIZATION EVALUATION");
        System.out.println("=".repeat(60));

        String runId = generateRunId();
        Instant startedAt = Instant.now();

        System.out.println("Run ID: " + runId);
        System.out.println("Started at: " + startedAt);

        // Paths
        Path scriptDir = Paths.get(System.getProperty("user.dir"));
        Path projectRoot;
        // If we're running from the evaluation dir, go up one level
        if (scriptDir.getFileName().toString().equals("evaluation")) {
            projectRoot = scriptDir.getParent();
        } else {
            projectRoot = scriptDir;
        }

        String testsDir = projectRoot.resolve("tests").toString();
        String beforePath = projectRoot.resolve("repository_before").toString();
        String afterPath = projectRoot.resolve("repository_after").toString();

        // Run tests on both
        Map<String, Object> beforeResults = runTestsWithRepo(beforePath, testsDir, "before (repository_before)");
        Map<String, Object> afterResults = runTestsWithRepo(afterPath, testsDir, "after (repository_after)");

        // Comparison
        @SuppressWarnings("unchecked")
        boolean beforePassed = (boolean) ((Map<String, Object>) beforeResults.get("tests")).get("passed");
        @SuppressWarnings("unchecked")
        boolean afterPassed = (boolean) ((Map<String, Object>) afterResults.get("tests")).get("passed");

        boolean passedGate = afterPassed;
        String improvementSummary;
        if (passedGate && !beforePassed) {
            improvementSummary = "Repository after passes all correctness tests while repository before fails as expected.";
        } else if (passedGate) {
            improvementSummary = "Repository after passes all correctness tests.";
        } else {
            improvementSummary = "Repository after failed correctness tests.";
        }

        // Print summary
        System.out.println("\n" + "=".repeat(60));
        System.out.println("EVALUATION SUMMARY");
        System.out.println("=".repeat(60));

        System.out.println("\nBefore Implementation (repository_before):");
        System.out.println("  Overall: " + (beforePassed ? "PASSED" : "FAILED"));

        System.out.println("\nAfter Implementation (repository_after):");
        System.out.println("  Overall: " + (afterPassed ? "PASSED" : "FAILED"));

        System.out.println("\n" + "=".repeat(60));
        System.out.println("EXPECTED BEHAVIOR CHECK");
        System.out.println("=".repeat(60));

        if (afterPassed) {
            System.out.println("[PASS] After implementation: All tests passed (expected)");
        } else {
            System.out.println("[FAIL] After implementation: Some tests failed (unexpected - should pass all)");
        }

        // Generate report
        Instant finishedAt = Instant.now();
        double durationSeconds = (finishedAt.toEpochMilli() - startedAt.toEpochMilli()) / 1000.0;

        String outputPath = generateOutputPath(projectRoot);

        String report = buildJson(
                runId, startedAt, finishedAt, durationSeconds,
                beforeResults, afterResults,
                passedGate, improvementSummary);

        try {
            Path outFile = Paths.get(outputPath);
            Files.createDirectories(outFile.getParent());
            Files.writeString(outFile, report);
            System.out.println("\n[PASS] Report saved to: " + outputPath);
        } catch (IOException e) {
            System.out.println("[FAIL] Could not write report: " + e.getMessage());
        }

        System.out.println("\n" + "=".repeat(60));
        System.out.println("EVALUATION COMPLETE");
        System.out.println("=".repeat(60));
        System.out.println("Run ID: " + runId);
        System.out.println(String.format("Duration: %.2fs", durationSeconds));
        System.out.println("Success: " + (passedGate ? "YES" : "NO"));

        System.exit(passedGate ? 0 : 1);
    }

    static String generateOutputPath(Path projectRoot) {
        LocalDateTime now = LocalDateTime.now();
        String dateStr = now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        return projectRoot.resolve("evaluation")
                .resolve(dateStr)
                .resolve("report.json")
                .toString();
    }

    // ---- Simple JSON builder (no external libs) ----

    @SuppressWarnings("unchecked")
    static String buildJson(String runId, Instant startedAt, Instant finishedAt,
            double duration,
            Map<String, Object> before, Map<String, Object> after,
            boolean passedGate, String improvementSummary) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        sb.append(jsonField("run_id", runId, 1));
        sb.append(jsonField("started_at", startedAt.toString(), 1));
        sb.append(jsonField("finished_at", finishedAt.toString(), 1));
        sb.append("  \"duration_seconds\": ").append(String.format("%.6f", duration)).append(",\n");
        sb.append("  \"environment\": {\n");
        sb.append(jsonField("java_version", getJavaVersion(), 2));
        sb.append(jsonFieldLast("platform", getPlatform(), 2));
        sb.append("  },\n");
        sb.append("  \"before\": ").append(mapToJson(before, 1)).append(",\n");
        sb.append("  \"after\": ").append(mapToJson(after, 1)).append(",\n");
        sb.append("  \"comparison\": {\n");
        sb.append("    \"passed_gate\": ").append(passedGate).append(",\n");
        sb.append(jsonFieldLast("improvement_summary", improvementSummary, 2));
        sb.append("  },\n");
        sb.append("  \"success\": ").append(passedGate).append(",\n");
        sb.append("  \"error\": null\n");
        sb.append("}\n");
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    static String mapToJson(Map<String, Object> map, int indent) {
        StringBuilder sb = new StringBuilder();
        String pad = "  ".repeat(indent);
        String padInner = "  ".repeat(indent + 1);
        sb.append("{\n");
        int count = 0;
        for (var entry : map.entrySet()) {
            count++;
            boolean last = count == map.size();
            Object val = entry.getValue();
            if (val instanceof Map) {
                sb.append(padInner).append("\"").append(entry.getKey()).append("\": ")
                        .append(mapToJson((Map<String, Object>) val, indent + 1));
            } else if (val instanceof Boolean) {
                sb.append(padInner).append("\"").append(entry.getKey()).append("\": ").append(val);
            } else if (val instanceof Number) {
                sb.append(padInner).append("\"").append(entry.getKey()).append("\": ").append(val);
            } else {
                sb.append(padInner).append("\"").append(entry.getKey()).append("\": \"")
                        .append(escapeJson(String.valueOf(val))).append("\"");
            }
            sb.append(last ? "\n" : ",\n");
        }
        sb.append(pad).append("}");
        return sb.toString();
    }

    static String jsonField(String key, String val, int indent) {
        return "  ".repeat(indent) + "\"" + key + "\": \"" + escapeJson(val) + "\",\n";
    }

    static String jsonFieldLast(String key, String val, int indent) {
        return "  ".repeat(indent) + "\"" + key + "\": \"" + escapeJson(val) + "\"\n";
    }

    static String escapeJson(String s) {
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    static String truncate(String s, int maxLen) {
        return s.length() <= maxLen ? s : s.substring(s.length() - maxLen);
    }

    static String readStream(InputStream in) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(in))) {
            String line;
            while ((line = r.readLine()) != null) {
                sb.append(line).append("\n");
            }
        }
        return sb.toString();
    }

    static void deleteIfExists(Path p) {
        try {
            Files.deleteIfExists(p);
        } catch (IOException ignored) {
        }
    }

    public static void main(String[] args) {
        runEvaluation();
    }
}
