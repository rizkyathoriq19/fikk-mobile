#include <unity.h>

#include "InputDebouncer.h"

using FikkDevice::BallDetectionDebouncer;

namespace {

void test_one_physical_pulse_produces_one_detection() {
  BallDetectionDebouncer debouncer(100);

  TEST_ASSERT_TRUE(debouncer.update(true, 0));
  TEST_ASSERT_FALSE(debouncer.update(true, 10));
  TEST_ASSERT_FALSE(debouncer.update(false, 20));
  TEST_ASSERT_FALSE(debouncer.update(true, 30));
  TEST_ASSERT_FALSE(debouncer.update(false, 40));
  TEST_ASSERT_TRUE(debouncer.update(true, 101));
}

void test_held_low_does_not_trigger() {
  BallDetectionDebouncer debouncer(100);

  TEST_ASSERT_FALSE(debouncer.update(false, 0));
  TEST_ASSERT_FALSE(debouncer.update(false, 100));
  TEST_ASSERT_TRUE(debouncer.update(true, 101));
}

}  // namespace

void setup() {
  UNITY_BEGIN();
  RUN_TEST(test_one_physical_pulse_produces_one_detection);
  RUN_TEST(test_held_low_does_not_trigger);
  UNITY_END();
}

void loop() {}
