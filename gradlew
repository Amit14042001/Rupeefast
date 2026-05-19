#!/bin/sh
# Gradle wrapper script for Unix/Linux/macOS

APP_NAME="Gradle"
SCRIPT=$(readlink -f "$0")
APP_HOME=$(dirname "$SCRIPT")
CLASSPATH="$APP_HOME/gradle/wrapper/gradle-wrapper.jar"

# JVM options
DEFAULT_JVM_OPTS='"-Xmx64m" "-Xms64m"'

set -- \
    -classpath "$CLASSPATH" \
    org.gradle.wrapper.GradleWrapperMain \
    "$@"

# Detect JAVA_HOME
if [ -n "$JAVA_HOME" ] ; then
    JAVACMD="$JAVA_HOME/bin/java"
else
    JAVACMD="java"
fi

exec "$JAVACMD" $DEFAULT_JVM_OPTS $JAVA_OPTS $GRADLE_OPTS "$@"
