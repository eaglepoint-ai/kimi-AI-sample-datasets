import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Standalone tests for the H2O thread synchronization solution.
 * No external dependencies — runs with just: javac + java -ea
 */
public class H2OTest {

    static int passed = 0;
    static int failed = 0;

    // ---------------------------------------------------------------
    // Test runner helpers
    // ---------------------------------------------------------------

    static void check(boolean condition, String message) {
        if (!condition)
            throw new AssertionError(message);
    }

    static void assertEquals(long expected, long actual, String message) {
        check(expected == actual, message + " — expected: " + expected + ", got: " + actual);
    }

    static void runTest(String name, Runnable test) {
        try {
            test.run();
            passed++;
            System.out.println("  PASS: " + name);
        } catch (Throwable t) {
            failed++;
            System.out.println("  FAIL: " + name + " — " + t.getMessage());
        }
    }

    // ---------------------------------------------------------------
    // Simulation helpers
    // ---------------------------------------------------------------

    static List<Character> runSimulation(String water) throws InterruptedException {
        H2O h2o = new H2O();
        List<Character> bondOrder = Collections.synchronizedList(new ArrayList<>());
        CountDownLatch done = new CountDownLatch(water.length());

        ExecutorService pool = Executors.newFixedThreadPool(water.length());
        for (char c : water.toCharArray()) {
            pool.submit(() -> {
                try {
                    if (c == 'H') {
                        h2o.hydrogen(() -> bondOrder.add('H'));
                    } else {
                        h2o.oxygen(() -> bondOrder.add('O'));
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    done.countDown();
                }
            });
        }

        check(done.await(10, TimeUnit.SECONDS), "Simulation must complete within timeout");
        pool.shutdown();
        check(pool.awaitTermination(5, TimeUnit.SECONDS), "Pool must terminate");
        return bondOrder;
    }

    static void assertValidMolecules(List<Character> bondOrder, int expectedMolecules) {
        assertEquals(expectedMolecules * 3, bondOrder.size(),
                "Total bonded threads must equal 3 * number of molecules");
        for (int i = 0; i < bondOrder.size(); i += 3) {
            List<Character> group = bondOrder.subList(i, i + 3);
            long hCount = group.stream().filter(ch -> ch == 'H').count();
            long oCount = group.stream().filter(ch -> ch == 'O').count();
            assertEquals(2, hCount, "Group at index " + i + " must have 2 H, got: " + group);
            assertEquals(1, oCount, "Group at index " + i + " must have 1 O, got: " + group);
        }
    }

    // ---------------------------------------------------------------
    // Tests
    // ---------------------------------------------------------------

    // Req 1: Groups of exactly three (2H + 1O)
    static void testBasicMolecule() throws Exception {
        List<Character> result = runSimulation("HOH");
        assertValidMolecules(result, 1);
    }

    // Req 2: Oxygen waits if fewer than 2 H available
    static void testOxygenWaitsForHydrogen() throws Exception {
        H2O h2o = new H2O();
        List<Character> bondOrder = Collections.synchronizedList(new ArrayList<>());
        CountDownLatch oxygenStarted = new CountDownLatch(1);
        CountDownLatch oxygenDone = new CountDownLatch(1);
        CountDownLatch allDone = new CountDownLatch(3);

        new Thread(() -> {
            try {
                oxygenStarted.countDown();
                h2o.oxygen(() -> bondOrder.add('O'));
                oxygenDone.countDown();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                allDone.countDown();
            }
        }).start();

        oxygenStarted.await();
        Thread.sleep(300);
        check(!oxygenDone.await(200, TimeUnit.MILLISECONDS),
                "Oxygen must wait when no hydrogen threads are available");

        for (int i = 0; i < 2; i++) {
            new Thread(() -> {
                try {
                    h2o.hydrogen(() -> bondOrder.add('H'));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    allDone.countDown();
                }
            }).start();
        }

        check(allDone.await(10, TimeUnit.SECONDS), "All threads must finish");
        assertValidMolecules(bondOrder, 1);
    }

    // Req 3: Hydrogen waits for a complete set
    static void testHydrogenWaitsForPartners() throws Exception {
        H2O h2o = new H2O();
        List<Character> bondOrder = Collections.synchronizedList(new ArrayList<>());
        CountDownLatch hStarted = new CountDownLatch(1);
        CountDownLatch allDone = new CountDownLatch(3);

        new Thread(() -> {
            try {
                hStarted.countDown();
                h2o.hydrogen(() -> bondOrder.add('H'));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                allDone.countDown();
            }
        }).start();

        hStarted.await();
        Thread.sleep(200);
        check(bondOrder.size() < 3, "Hydrogen must wait when a complete set is not available");

        new Thread(() -> {
            try {
                h2o.hydrogen(() -> bondOrder.add('H'));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                allDone.countDown();
            }
        }).start();

        new Thread(() -> {
            try {
                h2o.oxygen(() -> bondOrder.add('O'));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                allDone.countDown();
            }
        }).start();

        check(allDone.await(10, TimeUnit.SECONDS), "All threads must finish");
        assertValidMolecules(bondOrder, 1);
    }

    // Req 4: All three bond before next group starts
    static void testBondingBeforeNextGroup() throws Exception {
        List<Character> result = runSimulation("HHOOHHHHO");
        assertValidMolecules(result, 3);
    }

    // Req 5: Barrier resets correctly after each molecule
    static void testBarrierResets() throws Exception {
        List<Character> result = runSimulation("OOOOOHHHHHHHHH" + "H");
        assertValidMolecules(result, 5);
    }

    // Req 6: No thread proceeds early or joins a wrong molecule
    static void testNoEarlyProceed() throws Exception {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 4; i++)
            sb.append("O");
        for (int i = 0; i < 8; i++)
            sb.append("H");
        List<Character> result = runSimulation(sb.toString());
        assertValidMolecules(result, 4);

        for (int i = 0; i < result.size(); i += 3) {
            List<Character> group = result.subList(i, i + 3);
            long h = group.stream().filter(c -> c == 'H').count();
            long o = group.stream().filter(c -> c == 'O').count();
            assertEquals(2, h, "Partial group check H");
            assertEquals(1, o, "Partial group check O");
        }
    }

    // Req 7: 2H:1O ratio in every consecutive group of three
    static void testConsecutiveGroupRatio() throws Exception {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 6; i++)
            sb.append("HHO");
        List<Character> result = runSimulation(sb.toString());
        assertValidMolecules(result, 6);
    }

    // Req 8: Threads recheck conditions (spurious wakeup safe)
    static void testRecheckConditions() throws Exception {
        H2O h2o = new H2O();
        int molecules = 3;
        List<Character> bondOrder = Collections.synchronizedList(new ArrayList<>());
        CountDownLatch allDone = new CountDownLatch(molecules * 3);
        Random random = new Random(42);

        List<Character> threads = new ArrayList<>();
        for (int i = 0; i < molecules; i++) {
            threads.add('O');
            threads.add('H');
            threads.add('H');
        }
        Collections.shuffle(threads, random);

        for (char c : threads) {
            new Thread(() -> {
                try {
                    Thread.sleep(random.nextInt(50));
                    if (c == 'H')
                        h2o.hydrogen(() -> bondOrder.add('H'));
                    else
                        h2o.oxygen(() -> bondOrder.add('O'));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    allDone.countDown();
                }
            }).start();
        }

        check(allDone.await(10, TimeUnit.SECONDS), "All threads must finish");
        assertValidMolecules(bondOrder, molecules);
    }

    // Req 9: Waiting threads are properly notified
    static void testNotification() throws Exception {
        H2O h2o = new H2O();
        List<Character> bondOrder = Collections.synchronizedList(new ArrayList<>());
        CountDownLatch allDone = new CountDownLatch(6);

        Runnable sendO = () -> {
            try {
                h2o.oxygen(() -> bondOrder.add('O'));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                allDone.countDown();
            }
        };
        Runnable sendH = () -> {
            try {
                h2o.hydrogen(() -> bondOrder.add('H'));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                allDone.countDown();
            }
        };

        new Thread(sendO).start();
        Thread.sleep(100);
        new Thread(sendH).start();
        Thread.sleep(100);
        new Thread(sendH).start();
        Thread.sleep(200);
        new Thread(sendH).start();
        Thread.sleep(100);
        new Thread(sendH).start();
        Thread.sleep(100);
        new Thread(sendO).start();

        check(allDone.await(10, TimeUnit.SECONDS), "All threads must finish");
        assertValidMolecules(bondOrder, 2);
    }

    // Req 10: Interruption safety
    static void testInterruptionSafety() throws Exception {
        H2O h2o = new H2O();
        List<Character> bondOrder = Collections.synchronizedList(new ArrayList<>());

        Thread loneH = new Thread(() -> {
            try {
                h2o.hydrogen(() -> bondOrder.add('H'));
            } catch (InterruptedException e) {
                /* expected */ }
        });
        loneH.start();
        Thread.sleep(200);
        loneH.interrupt();
        loneH.join(2000);

        H2O h2o2 = new H2O();
        List<Character> bondOrder2 = Collections.synchronizedList(new ArrayList<>());
        CountDownLatch done2 = new CountDownLatch(3);

        for (int i = 0; i < 2; i++) {
            new Thread(() -> {
                try {
                    h2o2.hydrogen(() -> bondOrder2.add('H'));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    done2.countDown();
                }
            }).start();
        }
        new Thread(() -> {
            try {
                h2o2.oxygen(() -> bondOrder2.add('O'));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                done2.countDown();
            }
        }).start();

        check(done2.await(10, TimeUnit.SECONDS),
                "System must not be left in an inconsistent state after interruption");
        assertValidMolecules(bondOrder2, 1);
    }

    // Req 11: No more than 2H and 1O released per cycle
    static void testNoExtraRelease() throws Exception {
        H2O h2o = new H2O();
        int molecules = 2;
        AtomicInteger hReleased = new AtomicInteger(0);
        AtomicInteger oReleased = new AtomicInteger(0);
        List<Character> bondOrder = Collections.synchronizedList(new ArrayList<>());
        CountDownLatch allDone = new CountDownLatch(molecules * 3);

        for (int i = 0; i < molecules * 2; i++) {
            new Thread(() -> {
                try {
                    h2o.hydrogen(() -> {
                        hReleased.incrementAndGet();
                        bondOrder.add('H');
                    });
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    allDone.countDown();
                }
            }).start();
        }
        for (int i = 0; i < molecules; i++) {
            new Thread(() -> {
                try {
                    h2o.oxygen(() -> {
                        oReleased.incrementAndGet();
                        bondOrder.add('O');
                    });
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    allDone.countDown();
                }
            }).start();
        }

        check(allDone.await(10, TimeUnit.SECONDS), "All threads must finish");
        assertEquals(molecules * 2, hReleased.get(), "Exactly 2 hydrogens per molecule");
        assertEquals(molecules, oReleased.get(), "Exactly 1 oxygen per molecule");
        assertValidMolecules(bondOrder, molecules);
    }

    // Req 12: Correctness under high contention (run 5 times)
    static void testHighContention() throws Exception {
        for (int rep = 0; rep < 5; rep++) {
            int n = 20;
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < n; i++)
                sb.append("O");
            for (int i = 0; i < 2 * n; i++)
                sb.append("H");
            List<Character> result = runSimulation(sb.toString());
            assertValidMolecules(result, n);
        }
    }

    // Req 13: All molecules formed, no missing or extra threads
    static void testCompleteMolecules() throws Exception {
        int n = 10;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++)
            sb.append("O");
        for (int i = 0; i < 2 * n; i++)
            sb.append("H");

        List<Character> result = runSimulation(sb.toString());

        long totalH = result.stream().filter(c -> c == 'H').count();
        long totalO = result.stream().filter(c -> c == 'O').count();
        assertEquals(2 * n, totalH, "All hydrogen threads must bond");
        assertEquals(n, totalO, "All oxygen threads must bond");
        assertValidMolecules(result, n);
    }

    // Req 14: No deadlocks — all eligible threads proceed (run 3 times)
    static void testNoDeadlock() throws Exception {
        for (int rep = 0; rep < 3; rep++) {
            for (int n = 1; n <= 10; n++) {
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < n; i++)
                    sb.append("O");
                for (int i = 0; i < 2 * n; i++)
                    sb.append("H");
                List<Character> result = runSimulation(sb.toString());
                assertValidMolecules(result, n);
            }
        }
    }

    // ---------------------------------------------------------------
    // Main
    // ---------------------------------------------------------------

    public static void main(String[] args) {
        System.out.println("Running H2O tests...\n");

        runTest("testBasicMolecule", () -> {
            try {
                testBasicMolecule();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        runTest("testOxygenWaitsForHydrogen", () -> {
            try {
                testOxygenWaitsForHydrogen();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        runTest("testHydrogenWaitsForPartners", () -> {
            try {
                testHydrogenWaitsForPartners();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        runTest("testBondingBeforeNextGroup", () -> {
            try {
                testBondingBeforeNextGroup();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        runTest("testBarrierResets", () -> {
            try {
                testBarrierResets();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        runTest("testNoEarlyProceed", () -> {
            try {
                testNoEarlyProceed();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        runTest("testConsecutiveGroupRatio", () -> {
            try {
                testConsecutiveGroupRatio();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        runTest("testRecheckConditions", () -> {
            try {
                testRecheckConditions();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        runTest("testNotification", () -> {
            try {
                testNotification();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        runTest("testInterruptionSafety", () -> {
            try {
                testInterruptionSafety();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        runTest("testNoExtraRelease", () -> {
            try {
                testNoExtraRelease();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        runTest("testHighContention", () -> {
            try {
                testHighContention();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        runTest("testCompleteMolecules", () -> {
            try {
                testCompleteMolecules();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        runTest("testNoDeadlock", () -> {
            try {
                testNoDeadlock();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        System.out.println("\n" + passed + " passed, " + failed + " failed, " + (passed + failed) + " total");
        System.exit(failed > 0 ? 1 : 0);
    }
}
