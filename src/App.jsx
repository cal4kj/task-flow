import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Editor } from '@toast-ui/react-editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import Sortable from 'sortablejs';
import { marked } from 'marked';

marked.use({
  renderer: {
    link(href, title, text) {
      return `<a href="${href.href}" target="_blank" rel="noopener noreferrer">${href.text}</a>`;
    }
  }
});
import './App.css';
import { loadTasks, saveTasks } from './storage.js';

// --- Helper Components & Functions ---
const isCircularDependency = (childId, potentialParentId, tasks) => {
    if (childId === potentialParentId) return true;
    let currentId = potentialParentId;
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    while (currentId) {
        const currentTask = taskMap.get(currentId);
        if (currentTask.dependsOn === childId) return true;
        currentId = currentTask.dependsOn;
    }
    return false;
};

const RoundedArrow = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <marker id="arrowhead" markerWidth="4" markerHeight="5" refX="3" refY="2.5" orient="auto">
                <polygon points="0 0, 4 2.5, 0 5" fill="#888" />
            </marker>
        </defs>
        <path d="M3 4V11C3 15.4183 6.58172 19 11 19H18" stroke="#888" strokeWidth="2" markerEnd="url(#arrowhead)" />
    </svg>
);

function App() {
    const [tasks, setTasks] = useState([]);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [linkingState, setLinkingState] = useState({ active: false, childId: null });

    const inlineEditorRef = useRef(null);
    const listRef = useRef(null);

    // --- Effects ---
    useEffect(() => {
        loadTasks((result) => {
            if (result.tasks) setTasks(result.tasks);
        });
    }, []);

    useEffect(() => {
        // The initial load can cause a save, this prevents saving an empty array over existing data.
        if (tasks.length > 0) {
            saveTasks(tasks);
        }
    }, [tasks]);

    useEffect(() => {
        if (listRef.current) {
            new Sortable(listRef.current, {
                handle: '.drag-handle',
                animation: 150,
                onEnd: (evt) => {
                    const movedItemId = parseInt(evt.item.dataset.id, 10);
                    const targetItemId = evt.to.children[evt.newIndex]?.dataset.id ? parseInt(evt.to.children[evt.newIndex].dataset.id, 10) : null;
                    setTasks(currentTasks => {
                        const newTasks = [...currentTasks];
                        const movedItem = newTasks.find(t => t.id === movedItemId);
                        const fromIndex = newTasks.findIndex(t => t.id === movedItemId);
                        newTasks.splice(fromIndex, 1);
                        const toIndex = targetItemId ? newTasks.findIndex(t => t.id === targetItemId) : newTasks.length;
                        newTasks.splice(toIndex, 0, movedItem);
                        return newTasks;
                    });
                }
            });
        }
    }, []);

    // --- Handlers ---
    const handleAddTask = () => {
        const newTask = { id: Date.now(), content: '', isCompleted: false, dependsOn: null };
        setTasks(prevTasks => [newTask, ...prevTasks]);
        setEditingTaskId(newTask.id);
    };

    const handleDeleteTask = (taskId) => {
        setTasks(tasks.filter(task => task.id !== taskId && task.dependsOn !== taskId));
    };

    const handleToggleComplete = (taskId) => {
        setTasks(tasks.map(task => task.id === taskId ? { ...task, isCompleted: !task.isCompleted } : task));
    };

    const handleEditorChange = (taskId) => {
        const newContent = inlineEditorRef.current.getInstance().getMarkdown();
        setTasks(currentTasks => currentTasks.map(task =>
            task.id === taskId ? { ...task, content: newContent } : task
        ));
    };

    const handleEditorBlur = (task) => {
        if (task.content.trim() === '') {
            setTasks(currentTasks => currentTasks.filter(t => t.id !== task.id));
        }
        setEditingTaskId(null);
    };

    const handleStartLinking = (childId) => setLinkingState({ active: true, childId });

    const handleSetDependency = (parentTask) => {
        if (!linkingState.active || isCircularDependency(linkingState.childId, parentTask.id, tasks)) return;
        setTasks(tasks.map(task => task.id === linkingState.childId ? { ...task, dependsOn: parentTask.id } : task));
        setLinkingState({ active: false, childId: null });
    };

    const handleRemoveDependency = (childId) => {
        setTasks(tasks.map(task => task.id === childId ? { ...task, dependsOn: null } : task));
    };

    // --- Rendering Logic ---
    const hierarchicalTasks = useMemo(() => {
        const taskMap = new Map(tasks.map(task => [task.id, { ...task, children: [] }]));
        const topLevelTasks = [];
        for (const task of tasks) {
            if (task.dependsOn && taskMap.has(task.dependsOn)) {
                taskMap.get(task.dependsOn).children.push(taskMap.get(task.id));
            } else {
                topLevelTasks.push(taskMap.get(task.id));
            }
        }
        const flatList = [];
        function flatten(tasks, level) {
            for (const task of tasks) {
                flatList.push({ ...task, level });
                if (task.children.length) flatten(task.children, level + 1);
            }
        }
        flatten(topLevelTasks, 0);
        return flatList;
    }, [tasks]);

    return (
        <div className={`container mt-4 pb-4 ${linkingState.active ? 'is-linking' : ''}`}>

            <ul ref={listRef} className="list-group">
                {hierarchicalTasks.map(task => {
                    const isBeingEdited = editingTaskId === task.id;
                    const canBeParent = linkingState.active && !isCircularDependency(linkingState.childId, task.id, tasks);

                    return (
                        <li key={task.id} data-id={task.id} className={`list-group-item ${canBeParent ? 'can-be-parent' : ''}`}>
                            <div className="indentation-area" style={{ width: task.level * 40 + 'px' }}>
                                {task.level > 0 && <RoundedArrow />}
                            </div>
                            <div className="task-body">
                                <span className="drag-handle">&#x2630;</span>
                                <input type="checkbox" className="form-check-input task-checkbox" checked={task.isCompleted} onChange={() => handleToggleComplete(task.id)} disabled={isBeingEdited} />
                                
                                {isBeingEdited ? (
                                    <div className="w-100">
                                        <Editor 
                                            ref={inlineEditorRef} 
                                            initialValue={task.content} 
                                            height="160px" 
                                            initialEditType="markdown" 
                                            hideModeSwitch={true} 
                                            toolbarItems={[]} 
                                            previewStyle="vertical"
                                            onChange={() => handleEditorChange(task.id)}
                                            onBlur={() => handleEditorBlur(task)}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div className={`task-content ${task.isCompleted ? 'completed' : ''}`} onDoubleClick={() => linkingState.active ? handleSetDependency(task) : setEditingTaskId(task.id)}>
                                            <div dangerouslySetInnerHTML={{ __html: marked.parse(task.content || '<p><em>Double-click to add content...</em></p>') }} />
                                        </div>
                                        {task.dependsOn ? (
                                            <button onClick={() => handleRemoveDependency(task.id)} className="btn btn-link btn-sm dependency-btn" title="Remove dependency">-🔗</button>
                                        ) : (
                                            <button onClick={() => handleStartLinking(task.id)} className="btn btn-link btn-sm dependency-btn" title="Add dependency">🔗</button>
                                        )}
                                        <button onClick={() => handleDeleteTask(task.id)} className="btn btn-danger btn-sm delete-btn">Delete</button>
                                    </>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
            <div className="action-button">
                {linkingState.active ? (
                    <button onClick={() => setLinkingState({ active: false, childId: null })} className="btn btn-warning">Cancel Linking</button>
                ) : (
                    <button onClick={handleAddTask} className="btn btn-primary">+</button>
                )}
            </div>
        </div>
    );
}

export default App;