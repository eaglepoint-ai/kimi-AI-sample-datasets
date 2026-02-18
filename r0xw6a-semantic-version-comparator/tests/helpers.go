package tests

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func mustPass(t *testing.T, runPattern string) {
	t.Helper()
	out, err := runGoTest(repoAfterDir(), runPattern)
	if err != nil {
		t.Fatalf("expected PASS, got FAIL:\n%s", out)
	}
}

func mustFailWithMutant(t *testing.T, runPattern, mutantFilename string) {
	t.Helper()

	td := t.TempDir()
	copyDir(t, repoAfterDir(), td)

	mutantPath := filepath.Join(mutantsDir(), mutantFilename)
	mutantBytes, err := os.ReadFile(mutantPath)
	if err != nil {
		t.Fatalf("failed to read mutant file %s: %v", mutantPath, err)
	}

	// Overwrite implementation with mutant.
	if err := os.WriteFile(filepath.Join(td, "semver.go"), mutantBytes, 0o644); err != nil {
		t.Fatalf("failed to write mutant semver.go: %v", err)
	}

	out, err := runGoTest(td, runPattern)
	if err == nil {
		t.Fatalf("expected FAIL with mutant %s, but got PASS.\nOutput:\n%s", mutantFilename, out)
	}
	if strings.Contains(out, "we can't find any tests cases") {
		t.Fatalf("metatest failed: %s", out)
	}
}

func runGoTest(dir, runPattern string) (string, error) {
	// If there are no test files under `dir`, return a clear error used by the
	// meta-test harness so the 'repository_before' scenario reports the
	// expected "we can't find any tests cases" message instead of the raw
	// `go test` output.
	found := false
	err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasSuffix(d.Name(), "_test.go") {
			found = true
			return filepath.SkipDir
		}
		return nil
	})
	if err != nil {
		return fmt.Sprintf("failed to walk directory %s: %v", dir, err), err
	}
	if !found {
		msg := "we can't find any tests cases"
		return msg, fmt.Errorf(msg)
	}
	args := []string{"test", "./..."}
	if runPattern != "" {
		args = []string{"test", "-run", runPattern, "./..."}
	}

	cmd := exec.Command("go", args...)
	cmd.Dir = dir

	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf

	err = cmd.Run()
	return buf.String(), err
}

func repoAfterDir() string {
	p := os.Getenv("REPO_PATH")
	if p == "" {
		return filepath.Clean(filepath.Join("..", "repository_after"))
	}

	// Handle Git Bash path mangling on Windows when running in a Linux container.
	// e.g. /app/repository_after -> C:/Program Files/Git/app/repository_after
	if runtime.GOOS != "windows" {
		if idx := strings.Index(p, "/app/"); idx != -1 {
			p = p[idx:]
		}
	}

	return filepath.Clean(p)
}

func mutantsDir() string {
	return filepath.Clean(filepath.Join(".", "testdata", "mutants"))
}

func copyDir(t *testing.T, src, dst string) {
	t.Helper()

	entries, err := os.ReadDir(src)
	if err != nil {
		t.Fatalf("ReadDir(%s): %v", src, err)
	}

	for _, e := range entries {
		srcPath := filepath.Join(src, e.Name())
		dstPath := filepath.Join(dst, e.Name())

		if e.IsDir() {
			if err := os.MkdirAll(dstPath, 0o755); err != nil {
				t.Fatalf("MkdirAll(%s): %v", dstPath, err)
			}
			copyDir(t, srcPath, dstPath)
			continue
		}

		b, err := os.ReadFile(srcPath)
		if err != nil {
			t.Fatalf("ReadFile(%s): %v", srcPath, err)
		}
		if err := os.WriteFile(dstPath, b, 0o644); err != nil {
			t.Fatalf("WriteFile(%s): %v", dstPath, err)
		}
	}
}
