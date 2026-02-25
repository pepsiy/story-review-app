import re
import sys

def main():
    file_path = "e:/AI/tomtat.com.vn/story-review-app/packages/db/src/schema.ts"
    
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find all export const X = pgTable(..., { ... })
    # Using regex to insert `updatedAt` and `deletedAt` at the end of the table definition
    
    parts = re.split(r'(export const \w+ = pgTable\([^,]+,\s*\{)', content)
    
    if len(parts) == 1:
        print("No pgTable found or regex failed.")
        sys.exit(1)
        
    out = [parts[0]]
    for i in range(1, len(parts), 2):
        header = parts[i]
        body_and_rest = parts[i+1]
        
        # We need to find the matching '}' for the columns dictionary.
        # It's usually the first line that starts with "}," or "}"
        # We can extract the block before the first matching "}"
        
        brace_count = 1
        pos = 0
        in_string = False
        string_char = None
        
        while pos < len(body_and_rest) and brace_count > 0:
            char = body_and_rest[pos]
            if not in_string:
                if char in ("'", '"'):
                    in_string = True
                    string_char = char
                elif char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
            else:
                if char == string_char:
                    # check if escaped
                    if body_and_rest[pos-1] != '\\':
                        in_string = False
                        
            pos += 1
            
        columns_block = body_and_rest[:pos-1]
        rest = body_and_rest[pos-1:]
        
        # Check if updatedAt is already there
        has_updated = 'updatedAt:' in columns_block
        has_deleted = 'deletedAt:' in columns_block
        
        additions = []
        if not has_updated:
            additions.append("    updatedAt: timestamp('updated_at').defaultNow(),")
        if not has_deleted:
            additions.append("    deletedAt: timestamp('deleted_at'),")
            
        if additions:
            # We want to insert the additions before the last newline or at the end
            # Since cols are typically separated by commas, let's make sure the last col has a comma
            cols_clean = columns_block.rstrip()
            if cols_clean and not cols_clean.endswith(',') and not cols_clean.endswith('{'):
                cols_clean += ','
                
            new_columns_block = cols_clean + "\n" + "\n".join(additions) + "\n"
        else:
            new_columns_block = columns_block
            
        out.append(header + new_columns_block + rest)
        
    new_content = "".join(out)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
        
    print("Done adding timestamps to tables.")

if __name__ == "__main__":
    main()
