import { NextRequest, NextResponse } from 'next/server';
import { Sandbox } from 'e2b';

export async function POST(req: NextRequest) {
  try {
    const { sandboxId, errors } = await req.json();
    
    if (!sandboxId) {
      return NextResponse.json({ error: 'Sandbox ID is required' }, { status: 400 });
    }

    if (!errors || !Array.isArray(errors)) {
      return NextResponse.json({ error: 'Errors array is required' }, { status: 400 });
    }

    console.log(`[auto-fix-errors] Auto-fixing ${errors.length} errors for sandbox ${sandboxId}`);

    // Connect to the sandbox
    const sandbox = await Sandbox.connect(sandboxId, { apiKey: process.env.E2B_API_KEY });
    
    const fixResults = [];

    for (const error of errors) {
      try {
        let fixCommand = '';
        let fixDescription = '';

        switch (error.type) {
          case 'npm-missing':
            if (error.package) {
              fixCommand = `npm install ${error.package}`;
              fixDescription = `Installing missing package: ${error.package}`;
            }
            break;
          
          case 'import-error':
            // Try to install the package if it's a third-party import
            if (error.message.includes('Failed to resolve import') && error.package) {
              fixCommand = `npm install ${error.package}`;
              fixDescription = `Installing missing package: ${error.package}`;
            }
            break;
          
          case 'syntax-error':
            // For syntax errors, we'll need to analyze the specific file
            // This is more complex and would require AI analysis
            fixDescription = 'Syntax error detected - manual review needed';
            break;
          
          default:
            fixDescription = `Unknown error type: ${error.type}`;
        }

        if (fixCommand) {
          console.log(`[auto-fix-errors] Running: ${fixCommand}`);
          const result = await sandbox.run({
            cmd: fixCommand,
            timeout: 30000
          });
          
          fixResults.push({
            error: error,
            command: fixCommand,
            description: fixDescription,
            success: result.exitCode === 0,
            output: result.stdout,
            errorOutput: result.stderr
          });
        } else {
          fixResults.push({
            error: error,
            command: null,
            description: fixDescription,
            success: false,
            output: null,
            errorOutput: 'No automatic fix available'
          });
        }
      } catch (fixError) {
        console.error(`[auto-fix-errors] Failed to fix error:`, fixError);
        fixResults.push({
          error: error,
          command: null,
          description: 'Fix attempt failed',
          success: false,
          output: null,
          errorOutput: fixError instanceof Error ? fixError.message : 'Unknown error'
        });
      }
    }

    // Close the sandbox connection
    await sandbox.close();

    const successfulFixes = fixResults.filter(r => r.success).length;
    const totalErrors = errors.length;

    return NextResponse.json({
      success: true,
      message: `Auto-fixed ${successfulFixes}/${totalErrors} errors`,
      results: fixResults,
      summary: {
        total: totalErrors,
        fixed: successfulFixes,
        failed: totalErrors - successfulFixes
      }
    });

  } catch (error: any) {
    console.error('[auto-fix-errors] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to auto-fix errors' 
    }, { status: 500 });
  }
}
