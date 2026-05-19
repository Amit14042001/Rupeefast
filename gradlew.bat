@rem Gradle startup script for Windows

@if "%DEBUG%"=="" @echo off
@rem Set local scope for variables
setlocal

set APP_NAME=Gradle
set APP_BASE_NAME=%~n0
set APP_HOME=%~dp0

@rem Resolve JAVA_HOME
if defined JAVA_HOME goto findJavaFromJavaHome
set JAVA_EXE=java.exe
goto execute

:findJavaFromJavaHome
set JAVA_HOME=%JAVA_HOME:"=%
set JAVA_EXE=%JAVA_HOME%/bin/java.exe

:execute
@rem Setup classpath
set CLASSPATH=%APP_HOME%\gradle\wrapper\gradle-wrapper.jar

@rem Execute Gradle
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% "-classpath" "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*

:end
@rem End of main script
